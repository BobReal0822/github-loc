
import * as React from 'react';
import { MouseEvent } from 'react';
import { render } from 'react-dom';


// tslint:disable-next-line
import './less/index.less';

interface HomeStateInfo {
  color: string;
}

interface HomePropsInfo {
}

const Colors: {
  [key: string]: string;
} = {
  null: '',
  white: 'white',
  pink: 'pink',
  green: 'green'
};

const tt = chrome && chrome.extension && chrome.extension.getBackgroundPage() || {
  console: window.console
};
const thisConsole = tt && tt.console;
console.log = thisConsole && thisConsole.log;

class Home extends React.Component<HomePropsInfo, HomeStateInfo> {
  state: HomeStateInfo;

  constructor(props: HomePropsInfo) {
    super(props);
    this.state = {
      color: ''
    };
  }

  componentDidMount() {
    const self = this;

    console.log('in componentDidMount: ');

    this.getCurrentTabUrl(url => {
      console.log('url in getCurrentTabUrl callback: ', url);
      this.getSavedBackgroundColor(url, (savedColor: string) => {
        console.log('saved color: ', savedColor);
        if (savedColor) {
          this.changeBackgroundColor(savedColor);

          self.setState({
            color: savedColor
          });
        }
      });
    });
  }

  selectColor = (event: MouseEvent<HTMLOptionElement>) => {
    const color = event.currentTarget.value;

    console.log('color selected: ', color);

    this.setState({
      color
    });

    this.changeBackgroundColor(color);
    this.getCurrentTabUrl(url => {
      this.saveBackgroundColor(url, color);
    });
  }

  getSavedBackgroundColor = (url: string, callback: (url: string, cb?: any) => void) => {
    chrome.storage.sync.get(url, (items: any) => {
      console.log('url & items in getSavedBackgroundColor: ', url, items, items[url]);

      callback(items[url]);
    });
  }

  saveBackgroundColor = (url: string, color: string) => {
    const items: {
      [key: string]: string;
    } = {};

    console.log('url & color in saveBackgroundColor: ', url, color);

    items[url] = color;
    chrome.storage.sync.set(items);
  }

  changeBackgroundColor = (color: string) => {
    console.log('color in changeBackgroundColor: ', color);
    const script = `document.body.style.backgroundColor=' ${ color } ';`;

    chrome.tabs.executeScript({
      code: script
    });
  }

  getCurrentTabUrl = (callback: (url: string) => any) => {
    const queryInfo = {
      active: true,
      currentWindow: true
    };

    chrome.tabs.query(queryInfo, tabs => {
      const tab = tabs[0];
      const url = tab.url;

      console.log('tabs in getCurrentTabUrl: ', tabs);
      console.assert(typeof url === 'string', 'tab.url should be a string');

      callback(url || '');
    });
  }

  render() {
    const { color } = this.state;

    return (
      <div>
        <h1>Color: { color }</h1>
        <span>Choose a color</span>
        <select id='dropdown' onChange={ this.selectColor.bind(this) } >
          {
            Object.keys(Colors).map((item: string) => {
              return <option selected={ color === Colors[item] } key={ Colors[item] } value={ Colors[item] }>{ item }</option>;
            })
          }
        </select>
      </div>
    );
  }
}

render(<Home />, document.getElementById('container'));
