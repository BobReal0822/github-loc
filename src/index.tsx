
import * as Bluebird from 'bluebird';
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

const GithubApi = {
  getContent: 'https://api.github.com/repos/:owner/:repo/contents'
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
    console.log('in componentDidMount: ');
    this.getRepoInfo();
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
      let contents: FileContentInfo[] = [];

      console.log('response in getRepo: ', response);
      if (!body) {
        //
      } else {
        contents = await self.getRepoContents(body);
      }

      console.log(' contents in getRepo: ', contents);

      return contents.map(item => {
        const info = LocFile.getFileInfoByContent(item.name, item.content);
        data[info.lang] = (data[info.lang] || 0) + info.lines.total;
      });
    }).catch(err => {
      console.log('err in getRepo: ', err);
    });

    this.setState({
      data
    });
  }

  getRepoContents = async (source: GithubFileInfo): Promise<FileContentInfo[]> => {
    const self = this;
    const result: FileContentInfo[] = [];

    if (source && source.type === 'file') {
      const item = await Request.get(source.url).then(res => {
        const data = res && res.body;

        return {
          name: data && data.name,
          content: data && data.content
        };
      });

      result.push(item);
    } else if (source && source.type === 'dir') {
      const contents: GithubFileInfo[] = await Request.get(source.url).then(res => res && res.body);
      const data: FileContentInfo[] = [];

      await Bluebird.map(contents, async content => {
        const contentRes = await self.getRepoContents(content);
        data.concat(contentRes);
      });

      console.log('items in getRepoContents: ', data);

      result.concat(data);
    }

    return result;
  }

  render() {
    const { data } = this.state;

    return (
      <div className='github-loc'>
        <h3>Github loc</h3>
        <p className='loc-desc'>Counts the number of lines of your github repository.</p>
        <hr />
        <div className='loc-content'>
        {
          Object.keys(data).map(key => {
            const value = data[key];

            return <div key={ key + value } className='loc-item'>
              <label>{ key }: </label>
              <span>{ value }</span>
            </div>;
          })
        }
        </div>
      </div>
    );
  }
}

render(<Home />, document.getElementById('container'));
