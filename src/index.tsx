
import * as Bluebird from 'bluebird';
import * as _ from 'lodash';
import { LocFile } from 'node-loc';
import * as React from 'react';
import { render } from 'react-dom';
import * as Request from 'superagent';

// tslint:disable-next-line
import './less/index.less';

import { ClientId, ClientSecret } from './config';

interface HomeStateInfo {
  data: {
    [key: string]: number;
  };
  message: string;
  date: number;
}

interface HomePropsInfo {
}

interface FileContentInfo {
  name: string;
  content: string;
}

interface GithubFileInfo {
  name: string;
  size: number;
  url: string;
  type: string;
}

interface StorageItem {
  [key: string]: {
    [key: string]: number;
  } | number;
}

const bg = chrome && chrome.extension && chrome.extension.getBackgroundPage() || {
  console: window.console
};
const thisConsole = bg && bg.console;
console.log = thisConsole && thisConsole.log;

console.log('client data : ', ClientId, ClientSecret);
const GithubApi = {
  getContent: `https://api.github.com/repos/:owner/:repo/contents?client_id=${ ClientId }&client_secret=${ ClientSecret }`
};
const Reg = /^https\:\/\/github\.com\/(\w+)\/([a-zA-Z0-9-_\-\.]+)/;
const queryInfo = {
  active: true,
  currentWindow: true
};

function formatLabel(label: string): string {
  if (!label) {
    return '';
  }

  const res = label.split('');
  res[0] = label[0].toUpperCase();

  return res.join('');
}

function formatDate(date: number): string {
  const thisDate = new Date(date);

  return date ? thisDate.toLocaleString() : '';
}

function formatUrl(url: string) {
  const str = `client_id=${ ClientId }&client_secret=${ ClientSecret }`;

  return `${ url }${ url.indexOf('?') > -1 ? `&` : `?` }${ str }`;
}

class Home extends React.Component<HomePropsInfo, HomeStateInfo> {
  state: HomeStateInfo;

  constructor(props: HomePropsInfo) {
    super(props);
    this.state = {
      data: {},
      message: '',
      date: 0
    };
  }

  componentDidMount() {
    const self = this;

    this.getData((data, date) => {
      console.log('data & date in componentDidMount: ', data, date);

      if (data && Object.keys(data).length) {
        self.setState({
          data,
          date
        });
      }
    });
  }

  getUserAndRepoByUrl = (url: string): {
    user: string;
    repo: string;
  } => {
    const match = url && url.match(Reg);
    const user = match && match[1] || '';
    const repo = match && match[2] || '';

    if (!user || !repo) {
      this.setState({
        message: 'Not a github repository.'
      });
    }

    return {
      user,
      repo
    };
  }

  getRepoInfo = () => {
    const self = this;

    chrome.tabs.query(queryInfo, tabs => {
      const { url } = tabs && tabs[0];

      if (!url) {
        return;
      }

      const { user, repo } = this.getUserAndRepoByUrl(url);

      if (!user || !repo) {
        self.setState({
          message: 'Not a github repository.'
        });
      } else {
        const api = GithubApi.getContent.replace(':owner', user).replace(':repo', repo);
        this.getRepo(api);
      }
    });
  }

  getRepo = async (url: string) => {
    const self = this;
    const { data } = this.state;

    await Request.get(formatUrl(url)).then(async response => {
      const body = response && response.body;
      const contents: FileContentInfo[] = [];

      const temp = await Bluebird.map(body, async (item: GithubFileInfo) => {
        const contentItem = await self.getRepoContents(item);

        return contentItem;
      });
      temp.map(item => item.map(subItem => contents.push(subItem)));

      return contents;
    }).then(contents => {
      return contents.map(item => {
        if (item.name && item.content) {
          const info = LocFile.getFileInfoByContent(item.name, item.content);

          if (info.lang) {
            data[info.lang] = (data[info.lang] || 0) + info.lines.total;
          }
        }
      });
    }).catch(err => {
      //
      console.log('err when request: ', err);
    });

    this.setState({
      data,
      date: new Date().getTime()
    }, () => {
      self.setData(data);
    });
  }

  getRepoContents = async (source: GithubFileInfo): Promise<FileContentInfo[]> => {
    const self = this;
    const result: FileContentInfo[] = [];

    if (source && source.type === 'file') {
      const item = await Request.get(formatUrl(source.url)).then(res => {
        const { name, content } = res && res.body;

        return name && content && {
          name,
          content
        };
      }).catch(err => {
        //
        console.log('err when request: ', err);
      });

      if (item) {
        result.push(item);
      }
    } else if (source && source.type === 'dir') {
      const contents: GithubFileInfo[] = await Request.get(formatUrl(source.url)).then(res => res && res.body).catch(err => {
        //
        console.log('err when request: ', err);
      });
      const temp = await Bluebird.map(contents, async content => {
        return await self.getRepoContents(content);
      });

      temp.map(item => item.map(subItem => result.push(subItem)));
    }

    return result;
  }

  setData = (data: any) => {
    const { date } = this.state;

    chrome.tabs.query(queryInfo, tabs => {
      const { url } = tabs && tabs[0];
      const key = this.getUserAndRepoByUrl(url || '');
      const items: StorageItem = {};

      if (!url) {
        return;
      }

      items[key.user + key.repo] = {
        data,
        date
      };

      console.log('items in setData: ', items);
      chrome.storage.sync.set(items);
    });
  }

  getData = (callback: (data: any, date: number) => any) => {
    const self = this;
    // const { data } = this.state;

    chrome.tabs.query(queryInfo, tabs => {
      const { url } = tabs && tabs[0];
      const key = this.getUserAndRepoByUrl(url || '');

      if (!url) {
        return;
      }

      chrome.storage.sync.get(key.user + key.repo, items => {
        const content = items[key.user + key.repo] || {};
        const { data, date } = content;

        console.log('items in getData: ', items);
        callback(data, date);
      });
    });
  }

  beginCount = () => {
    const self = this;

    this.getData((data, date) => {
      if (data && Object.keys(data).length) {
        self.setState({
          data,
          date
        });
      } else {
        self.getRepoInfo();
      }
    });
  }

  render() {
    const { data, message, date } = this.state;
    const renderData = Object.keys(data).map(key => ({
      label: formatLabel(key),
      value: data[key]
    })).sort((prev, next) => next.value - prev.value);

    if (renderData && renderData.length) {
      renderData.push({
        label: 'Total',
        value: _.sum(renderData.map(item => item.value))
      });
    }

    return (
      <div className='github-loc'>
        <div className='loc-header'>
          <h2>Github Loc</h2>
          <p className='loc-desc'>Counts the lines of code in a github repository.</p>
        </div>
        <div className='loc-content'>
        {
          message ? <p className='loc-content-message'>{ message }</p> : ''
        }
        {
          !message && renderData.length ? renderData.map(item => {
            return <div key={ item.label + item.value } className='loc-item'>
              <label>{ item.label }: </label>
              <span>{ item.value }</span>
            </div>;
          }) : (!message ? <p className='loc-content-message'>No data.</p> : '')
        }
        </div>
        <div className={ `loc-footer  border-top ${ message ? ' footer-disabled' : ''}` }>
          <button disabled={ !!message } onClick={ this.beginCount }>{ date && renderData.length ? 'Recount' : 'Count' }!</button><span title='Updated date' className='loc-footer-date'>{ formatDate(date) }</span>
        </div>
      </div>
    );
  }
}

render(<Home />, document.getElementById('container'));
