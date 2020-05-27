

import React, { Component } from 'react';
import './App.scss';

import logo from './logo.png';

import minimize from './minus.png';
import close from './x.png';

import PerformanceGraph from './components/PerformanceGraph/PerformanceGraph';
import StartButton from './components/StartButton/StartButton';
import CommandLine from './components/CommandLine/CommandLine';
import ServerManager from './serverManager/serverManager';
import PlayerList from './components/PlayerList/PlayerList';

const {remote, clipboard} = window.require('electron');

class App extends Component {
  constructor() {
    super();
    this.state = {
      perfData: [],  
      serverState: "stopped",
      log: [],
      ip: "",
      version: {},
      playerList: []
    }

    this.serverManager = new ServerManager({
      saveDirectory:  "./servers"
    });

    this.perfCheckInterval = null;

  }

  minimize() {
    var window = remote.getCurrentWindow();
    window.minimize();
  }

  close() {

    let activeServer = this.serverManager.activeServer;

    if(activeServer) {
      this.serverManager.stopServer();
      this.setState({serverState: "loading"});

      activeServer.on('serverShutdown', ()=>{
        var window = remote.getCurrentWindow();

        window.close();
      })
    } else {
      var window = remote.getCurrentWindow();

      window.close();
    }
  }

  updatePlayerList() {
    let activeServer = this.serverManager.activeServer;
    console.log("updaing player list ", activeServer.getPlayers());
    if(activeServer != null) {
      this.setState({playerList: activeServer.getPlayers()})
    } else {
      this.setState({playerList: []})
    }
  }

  startPerfCheck() {

    let activeServer = this.serverManager.activeServer;

    if(activeServer != null) {

      this.perfCheckInterval = setInterval(()=>{

        activeServer.getUsage().then((stats)=>{
          this.state.perfData.push([new Date().getTime(), stats]);
          this.state.perfData = this.state.perfData.slice(this.state.perfData.length-350);
          this.setState({perfData: this.state.perfData});
        })


      }, 2000);
    }
  }

  endPerfCheck() {
    clearInterval(this.perfCheckInterval);
  }

  startServer(version) {

    let versions = this.serverManager.getServerVersions();
    let target = versions[version];
    
    if(target) {

      
      this.setState({serverState: "loading"});

      let activeServer = this.serverManager.startServer({
        version: "vanilla_1.15.2", 
        allocatedRam: 2048, 
        port: 25565
      });

      this.setState({version: activeServer.getServerVersion()})

      // get server connection info
      activeServer.getIP().then((ip)=>{
        this.setState({ip});
      }).catch(()=>{
        console.log("could not get ip");
      })


      activeServer
      .on('serverStarting', ()=> {
        console.log("server booting up");
        this.setState({serverState: "running"})

        this.startPerfCheck();
      })
      .on('serverShutdown', ()=> {
        console.log("server shutting down");
        this.setState({serverState: "stopped", ip: ""})
        
        this.endPerfCheck();
      })
      .on('log', (message)=>{
        this.state.log.unshift(message);
        this.setState({log: this.state.log});
      })
      .on('playerJoin', ()=>{
        this.updatePlayerList();
      })
      .on('playerLeave', ()=>{
        this.updatePlayerList();
      });

    }
  }

  toggleServerState() {

    // Run server
    if(this.state.serverState == "stopped") {

      let versions = this.serverManager.getServerVersions();

      console.log(versions);

      if(Object.keys(versions).length == 0) {
        console.log("No servers available");
        console.log("downloading one");

        this.serverManager.downloadLatest(()=>{
          console.log("done downloading!");
          this.setState({serverState: "stopped"});
        });

        this.setState({serverState: "downloading"})

      } else {

        console.log("There are server versions available");
        console.log(versions);

        // !TEMPORARY TESTING
        this.startServer("vanilla_1.15.2")
        // there are server versions to choose from 
      }

    } else if (this.state.serverState == "running") {

      let activeServer = this.serverManager.activeServer;

      this.setState({serverState: "loading"})

      if(activeServer != null) {
        this.serverManager.stopServer();
      }

    }
  }

  sendCommand(data) {
    let activeServer = this.serverManager.activeServer;
    
    if(activeServer != null) {
      console.log("sending data to server");
      activeServer.send(data);
    }
  }

  kickPlayer(name) {
    this.sendCommand('kick ' + name);
  }

  copyIP() {
    clipboard.writeText(this.state.ip);
  }

  render() {
    return (
      <div className="app flex-column">
        <div className='app-control flex-row'>
          <div className='drag-region'></div>
          <div className='group flex-row'>
            <div className='action' onClick={this.minimize.bind(this)}>
              <img src={minimize} className='icon'></img>
            </div>
            <div className='action' onClick={this.close.bind(this)}>
              <img src={close} className='icon'></img>
            </div>
          </div>
        </div>
        <div className='header flex-row'>
            <div className='serverInfo flex-row'>
              <div className='drag'>
                <img src={logo} className='icon'></img>
              </div>
              <div className='title'>{this.state.version.name || ""}</div>
              <div className='version'>{this.state.version.number || ""}</div>
            </div>
            <div className='controls flex-row'>
              {this.state.ip?<div className='address' onClick={this.copyIP.bind(this)}>
                {this.state.ip?this.state.ip:""}
              </div>:""}
              <StartButton action={this.state.serverState} onClick={this.toggleServerState.bind(this)}></StartButton>
            </div>
        </div>
        <div className='content flex-column'>
          <PerformanceGraph data={this.state.perfData}></PerformanceGraph>
          <div className='interface flex-row'>
            <PlayerList list={this.state.playerList} onKickPlayer={this.kickPlayer.bind(this)}></PlayerList>
            <CommandLine log={this.state.log} onCommandEnter={(evt)=>{this.sendCommand(evt.target.value)}}></CommandLine>
          </div>
        </div>
      </div>
    );
  }
}

export default App;
