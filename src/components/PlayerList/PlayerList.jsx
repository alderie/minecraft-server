import React, {Component} from 'react';

import './PlayerList.scss';

import remove from './user-x.png';

const got = window.require('got');

class PlayerList extends Component {
    constructor(props) {
        super(props);
    }

    getPlayerHeadURL(name) {
        return `https://www.mc-heads.net/avatar/${name}/100`
    }

    render() {
        return (
            <div className={'playerList ' + (this.props.list.length == 0 ? "empty" : "")}>
                {this.props.list.map(o=>(
                    <div className='player flex-row'>
                        <img src={this.getPlayerHeadURL(o)} className='head'></img>
                        <div className='name'>{o}</div>
                        <div className='action' onClick={()=>{this.props.onKickPlayer(o)}}>
                            <img src={remove} className='icon'></img>
                        </div>
                    </div>
                ))}
                <div className='title'><b>{this.props.list.length}</b> players</div>
            </div>
        )
    }
}

export default PlayerList;