
import React, {Component} from 'react';

import './CommandLine.scss';

import prompt from './prompt.svg';


class CommandLine extends Component {
    constructor(props) {
        super(props);
    }

    onKeyPress(evt) {
        // enter key pressed
        if(evt.charCode == 13) {
            this.props.onCommandEnter(evt);
            evt.target.value = "";
        }
    }

    render() {
        return (
            <div className='command'>
                <div className='input flex-row'>
                    <img src={prompt} className='icon'></img>
                    <input className='large' placeholder="enter command" onKeyPress={this.onKeyPress.bind(this)}></input>
                </div>
                <div className='output'>
                    {
                    // can expand this method later to support more detailed logging
                    this.props.log.map((o,i)=>
                        <div key={i} className='log-message flex-row'>
                            <div className='time'>{o.time}</div>
                            <div className='message'>{o.content}</div>
                        </div>
                    )}
                </div>
            </div>
        );
    }
}

export default CommandLine;