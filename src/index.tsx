
import * as Bluebird from 'bluebird';
import * as _ from 'lodash';
import { LocFile } from 'node-loc';
import * as React from 'react';
import { render } from 'react-dom';
import * as Request from 'superagent';

// tslint:disable-next-line
import './less/index.less';

interface HomeStateInfo {
  data: {
    [key: string]: number;
  };
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

const bg = chrome && chrome.extension && chrome.extension.getBackgroundPage() || {
  console: window.console
};
const thisConsole = bg && bg.console;
console.log = thisConsole && thisConsole.log;

const ClientId = '810e591519c3ed77774e';
const ClientSecret = '91dd3d397fb8109fd6ce1054a4b12eb87436eb33';
const GithubApi = {
  getContent: `https://api.github.com/repos/:owner/:repo/contents?client_id=${ ClientId }&client_secret=${ ClientSecret }`
};
const Reg = /^https\:\/\/github\.com\/(\w+)\/([a-zA-Z0-9-_]+)/;

class Home extends React.Component<HomePropsInfo, HomeStateInfo> {
  state: HomeStateInfo;

  constructor(props: HomePropsInfo) {
    super(props);
    this.state = {
      data: {}
    };
  }

  componentDidMount() {
    // console.log('in componentDidMount: ');
  }

  getRepoInfo = () => {
    const queryInfo = {
      active: true,
      currentWindow: true
    };

    chrome.tabs.query(queryInfo, tabs => {
      const { url } = tabs && tabs[0];
      if (!url) {
        return;
      }

      const match = url.match(Reg);
      const user = match && match[1];
      const repo = match && match[2];

      if (!user) {
        console.log('no user.');
      } else if (!repo) {
        console.log('no repo');
      } else {
        const api = GithubApi.getContent.replace(':owner', user).replace(':repo', repo);
        this.getRepo(api);
      }
    });
  }

  getRepo = async (url: string) => {
    const self = this;
    const { data } = this.state;
    console.log('url in getRepo: ', url);

    await Request.get(url).then(async response => {
      const body = response && response.body;
      const contents: FileContentInfo[] = [];

      const temp = await Bluebird.map(body, async (item: GithubFileInfo) => {
        console.log('item before await: ', item);
        const contentItem = await self.getRepoContents(item);
        console.log('contentItem: ', contentItem);
        // contents.concat(contentItem);
        return contentItem;
      });

      // contents = temp.reduce((a, b) => a.concat(b));
      temp.map(item => item.map(subItem => contents.push(subItem)));

      console.log('contents should return: ', temp, contents);

      return contents;
    }).then(contents => {
      console.log('contents returned: ', contents);

      return contents.map(item => {
        const info = LocFile.getFileInfoByContent(item.name, item.content);

        if (info.lang) {
          data[info.lang] = (data[info.lang] || 0) + info.lines.total;
        }
      });
    }).catch(err => {
      console.log('err in getRepo: ', err);
    });

    console.log('result data: ', data);
    this.setState({
      data
    });
  }

  getRepoContents = async (source: GithubFileInfo): Promise<FileContentInfo[]> => {
    const self = this;
    const result: FileContentInfo[] = [];

    console.log('source in gerRepoContents: ', source);
    if (source && source.type === 'file') {
      const item = await Request.get(source.url).then(res => {
        const { name, content } = res && res.body;

        return name && content && {
          name,
          content
        };
      });

      result.push(item);
    } else if (source && source.type === 'dir') {
      const contents: GithubFileInfo[] = await Request.get(source.url).then(res => res && res.body);
      const temp = await Bluebird.map(contents, async content => {
        console.log('content in getRepoContents: ', content);

        return await self.getRepoContents(content);
      });

      temp.map(item => item.map(subItem => result.push(subItem)));

      console.log('result in getRepoContents dir: ', result);
    }

    return result;
  }

  setData = () => {
    //
  }

  getData = () => {
    //
  }

  beginCount = () => {
    this.getRepoInfo();
  }

  render() {
    const { data } = this.state;
    const renderData = Object.keys(data).map(key => ({
      label: key,
      value: data[key]
    })).sort((prev, next) => next.value - prev.value);

    return (
      <div className='github-loc'>
        <div className='loc-header'>
          <h2>Github loc</h2>
          <p className='loc-desc'>Counts the number of lines of your github repository.</p>
        </div>
        <div className='loc-content'>
        {
          renderData.map(item => {
            return <div key={ item.label + item.value } className='loc-item'>
              <label>{ item.label }: </label>
              <span>{ item.value }</span>
            </div>;
          })
        }
        </div>
        <div className={ 'loc-footer ' + (renderData.length ? 'border-top' : '') }>
          <button onClick={ this.beginCount }>Count now!</button>
        </div>
      </div>
    );
  }
}

render(<Home />, document.getElementById('container'));
