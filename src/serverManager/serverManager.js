const spawn = window.require('child_process').spawn,
      fs = window.require('fs'),
      path = window.require('path'),
      //chalk = window.chalk,
      pidusage = window.require('pidusage'),
      got = window.require('got'),
      download = window.require('download'),
      NatAPI = window.require('nat-api'),
      cpu = window.require('systeminformation').cpu;




// Maintains a server.properties file
class ServerProps {
    constructor(filePath) {

        this.filePath = filePath;
        this.properties = {};

        if(!fs.existsSync(filePath)) {
            throw Error(filePath + " properties file does not exist!");
        }

        let text = fs.readFileSync(filePath, 'utf-8');

        let lines = text.split(/\r?\n/).filter(o=>o!="");

        lines.forEach(line=>{
            // comments start with #
            if(!line.startsWith("#")) {
                let parts = line.split("=");

                this.properties[parts[0]] = parts[1];
            }
        })

    }

    set(name, value) {
        this.properties[name] = value.trim();
        this.save();
    }

    get(name) {
        return this.properties[name];
    }

    save() {
        let output = "";
        output+="#Minecraft server properties\n"
              +`#${new Date().toUTCString()}\n`;
        for(let key in this.properties) {
            output+=`${key}=${this.properties[key]}\n`
        }

        fs.writeFileSync(this.filePath, output);
    }
}

// Manages a single server instance
class ServerHandler {
    constructor({
        version,
        directory, 
        port = -1,
        allocatedRam = 2048 // in MB
    }) {

        this.version = version.split("_");
        this.port = port;
        this.directory = directory;
        this.allocatedRam = allocatedRam;
        this.serverProcess = null;

        this.playerList = {};

        this.eventListeners = {};
    }

    getServerVersion() {
        return {name: this.version[0], number: this.version[1]};
    }

    has(text, part) {
        return text.indexOf(part) > -1
    }

    getPlayers() {
       let players = [];
       for(let uuid in this.playerList) {
           players.push(this.playerList[uuid].name);
       }
       return players;
    }

    getIP() {
        return new Promise((resolve,reject)=>{

            let client = new NatAPI();

            client.externalIp((err, ip)=>{
                if (err) reject(err);
                resolve(ip + ":" + this.port);
            })
        })

    }

    getUsage() {
       return new Promise(async (resolve,reject)=>{

            if(!this.cores) {
                let data = await cpu();
                this.cores = data.cores;
            }

            pidusage(this.serverProcess.pid, (err,stat)=>{
                if(err) reject(err);
                if(stat) {
                    stat.cpu = stat.cpu / this.cores;
                    resolve(stat);
                }
            })

       }) 
    }

    getProperties() {
        return this.serverProperties;
    }

    on(name, callback) {
        if(!this.eventListeners[name]) {
            this.eventListeners[name] = [];
        }

        if(this.eventListeners[name].indexOf(callback) == -1)
            this.eventListeners[name].push(callback);

        return this;
    }

    emit(name, data = {}) {
        if(this.eventListeners[name]) {
            for(let func of this.eventListeners[name]) {
                func(data);
            }
        }
    }

    handleLog(chunk) {

        let line = chunk.replace(/\n/,"");
        
        // Deconstruct the line
        let match = /\[([^\]]+)\]\s\[([^\]]+)\]: (.+)/g.exec(line);

        if(!match)
            return;
        
        let [full, time, status, content] = match;

        this.emit('log', {time, status, content});

        // On eula sign requirement
        if(this.has(content, "eula")) {

            this.signEula();

        } else if (this.has(content, "Starting minecraft server")) {

            this.serverProperties = new ServerProps(path.join(this.directory, "server.properties"));
            this.emit("serverStarting");

        // On server done loading
        } else if (this.has(content, "Done")) {

            this.emit('serverDoneLoading');

        // On player join
        } else if (this.has(content, "UUID of player")) {

            let matches = (/UUID of player (.+) is (.+)/g.exec(content));

            if(matches) {
                let playerData = {name: matches[1], uuid: matches[2], joined: new Date()};
                this.playerList[playerData.uuid] = playerData;
                this.emit('playerJoin', playerData);
            }
            
        // On player leave
        } else if (this.has(content, "lost connection:")) {
            let playerName = (/(.+) lost connection:/g.exec(content))[1];

            // remove player and emit events
            for(let key in this.playerList) {

                if(this.playerList[key].name == playerName) {
 
                    let player = this.playerList[key];
                    delete this.playerList[key];
                    this.emit('playerLeave', player);
                }
            }
        } else if (this.has(content, "Kicked by an operator")) {
            let playerName = (/^Kicked (.+): Kicked by an operator$/g.exec(content))[1];

            // remove player and emit events
            for(let key in this.playerList) {

                if(this.playerList[key].name == playerName) {

                    let player = this.playerList[key];
                    delete this.playerList[key];
                    this.emit('playerLeave', player);
                    this.emit('playerKicked', player);
                }
            }
        } else if (this.has(content, "Stopping server")) {
            this.emit('serverShutdown');
        }
    }

    signEula() {
        //let eula = fs.readFileSync(path.join(this.directory, 'eula.txt'));
        fs.writeFileSync(path.join(this.directory, 'eula.txt'), 'eula=true');
        this.start();
    }

    handleError(data) {
        console.error(data);
    }

    send(data) {
        this.serverProcess.stdin.write("/" + data + "\n");   
    }

    stop() {

        this.playerList = {};
        
        if(!this.serverProcess) {
            return;
        }

        this.send('stop');
    }

    start() {

        const client = new NatAPI()

        // Only map port if the server succesfully started
        this.on('serverStarting', ()=>{
            //map target port to server
            client.map(this.port, function (err) {
                if(err){
                    console.log('Error', err)
                }

                console.log("port mapped!");
            });
        });

        this.on('serverShutdown', ()=>{
            // Unmap the port and destroy the client
            client.unmap(this.port, function (err) {
                console.log('Port unmapped!');
                client.destroy();
            });
        })

        this.serverProcess = spawn('java', [`-Xmx${this.allocatedRam}M`, `-Xms${this.allocatedRam}M`,'-jar', 'server.jar', 'nogui'], {
            cwd: this.directory
        });

        // Set output encoding for streams
        this.serverProcess.stderr.setEncoding("utf8");
        this.serverProcess.stdout.setEncoding("utf8");
    
        this.serverProcess.stdout.on('data', this.handleLog.bind(this));
        this.serverProcess.stderr.on('data', this.handleError.bind(this));
        
        this.serverProcess.on('close', (code) => {
            this.emit('serverExit');
        });
    }
}


class ServerManager {
    constructor({
        saveDirectory,
    }) {

        if(!saveDirectory) {
            throw new Error("No save directory specified!");
        }

        this.saveDirectory = saveDirectory;
        this.activeServer = null;

        this.loadServerVersions();

    }

    loadServerVersions() {
        // Load server versions
        let serverVersions = fs.readdirSync(this.saveDirectory);
        this.servers = {};
    
        for(let version of serverVersions) {
            this.servers[version] = path.join(this.saveDirectory, version)
        }

        return this.servers;
    }

    getServerVersions() {
        return this.loadServerVersions();
    }

    downloadLatest(callback) {
        
        let url = "https://www.minecraft.net/content/minecraft-net/language-masters/en-us/download/server/_jcr_content/root/generic-container/par/page_section_contain/page-section-par/minecraft_version.nocache.html/";
        
        got(url).then((res)=>{

            console.log("got stuff from internet", res);
            let html = res.body;
    
            let match = /<a href="([^"]+)"[^>]+>minecraft_server\.((?:\d|\.)+)\.jar</.exec(html);
    
            if(match) {

                let url = match[1];
                let version = match[2];
                let targetPath = path.join(this.saveDirectory, `vanilla_${version}`);

                if(!fs.existsSync(targetPath)) {
                    download(url, targetPath).then(()=>{
                        callback();
                    })
                } else {
                    callback();
                    console.log("Server version already exists!");
                }
            }
        })
    }

    startServer({version, allocatedRam = 2048, port = 25565}) {

        let serverFile = this.servers[version];

        if(!version) {
            return;
        }

        if(this.activeServer != null) {
            console.log("server already running");
            return;
        }

        this.activeServer = new ServerHandler({version, directory: serverFile, port, allocatedRam});

        this.activeServer.start();

        this.activeServer.on('serverStarting', ()=> {
            this.serverRunning = true;
        })

        this.activeServer.on('serverShutdown', (code) => {
            this.serverRunning = false;
            this.activeServer = null;
        });

        return this.activeServer;
    }

    stopServer() {
        if(this.activeServer)
            this.activeServer.stop();
    }

}

export default ServerManager;