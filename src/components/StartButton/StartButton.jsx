
import React, {Component} from 'react';

import './StartButton.scss';

import power from "./power.png";
import square from './square.png';
import down from './arrow-down.png';

class StartButton extends Component {

    constructor(props) {
        super(props);
    }

    check(tree) {
        for(let key in tree) {
            if(this.props.action == key) {
                return tree[key];
            }
        }
        return tree["stopped"];
    }

    render() {
        return (
           <div className='serverControl flex-column'>
            <div className={'button ' + (this.props.action)} onClick={this.props.onClick}>
                {this.check({
                    "stopped": (<img src={power} className='icon'></img>),
                    "running": (<img src={square} className='icon active'></img>),
                    "downloading": (<img src={down} className='icon download'></img>),
                    "loading": (<div className="loader"><div></div><div></div></div>)
                })}
            </div>
            {/*<div className='notification green'>
                <div className='status'>starting</div>
            </div>*/}
          </div>
        )
    }
}

export default StartButton;