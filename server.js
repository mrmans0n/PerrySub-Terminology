// Servidor PerrySub con node.js
// (c) 2012 Nacho Lopez 

var net = require("net");
var fs = require("fs");
var alfred = require("alfred");
var HOST = "127.0.0.1";
var PORT = 26108;
var HANDSHAKE = "mrmr0x";

var server = net.createServer(function(socket) {

	socket.name = socket.remoteAddress + ":" + socket.remotePort
	server.name = server.address().family+" "+server.address().address+":"+server.address().port;

	socket.write("Secret word?\n");
	
	var waitingHandshake = true;
	
	// Lo que se invoca al conectar
	socket.on("connect",function() {
		console.log("Connection from "+socket.name+" received");
	});
	
	// Datos que recibimos
	socket.on("data", function(rawData) {
		
		var data = rawData.toString();
		
		// Validamos el handshake
		if (waitingHandshake) {
			if (data.indexOf(HANDSHAKE)!==0) {
				socket.end("-_-\n");
				console.log("Failed handshake with "+socket.name+" ("+data+")");
			} else {
				
				// Keep'on rollin' baby.
				console.log("Handshake OK with "+socket.name);
				socket.write("Welcome to "+server.name+" PerrySub terminology server.\n");		
				waitingHandshake = false;		
				socket.write("Waiting for commands... \n");
			}
		} else {
			
			// El bucle principal del servidor			
			// Aceptamos comandos: dicts | dictcreate [x] | dictlist [x] | dictdel [x] | dictinsert [x] | dictremove [x] | quit
			
			// Dicts
			// Devuelve un listado de diccionarios. La última línea es un punto.
			if (data.indexOf("dicts") === 0) {
				fs.readdir("*.dict", function (err, files){
					for (var d in files) {
						socket.write(d.replace(".dict",""));
					}
					socket.write(".\n");
				});
			}
			
			// DictCreate
			// Crea un nuevo diccionario (nueva base de datos)
			if (data.indexOf("dictcreate ") === 0) {
				var dictName = data.replace("dictcreate ","").replace("\n","").replace("\r","")+".dict";
				if (fs.existsSync(dictName)) {
					socket.write("That database already exists, skipping!\n");
				} else {
					console.log("Trying to create a new database: "+dictName);
					fs.mkdirSync(dictName);
					alfred.open(dictName, function(err, db) {
						if (err) { return; }
						var terminology = db.define("terminology");
						terminology.property("key","string", {
							required: true
						});
						terminology.property("value","string", {
							required: true
						});
						terminology.index("key", function(term){
							return term.key;
						});
						var term = terminology.new({"key":"A key", "value":"This is an example value for a recently created dictionary!"});
						term.save(function(error) {
							if (error) {
								console.log("Database was created but couldn't save data!\n");
							} else {
								console.log("Database created!\n");
							}
						});
					});
				}
			}
			
			// DictList
			// Lista los terminos que hay en una base de datos
			if (data.indexOf("dictlist ") === 0) {
				var dictName = data.replace("dictlist ","").replace("\n","").replace("\r","")+".dict";
				console.log("Accessing (at least trying to) database: "+dictName);
					
				alfred.open(dictName, function(err, db) {
					if (err) { console.log(err); return; }
						
					var terminology = db.define("terminology");
						
					terminology.find({"key":{$neq : ""}}).all(function(terms) {
						for (var t in terms) {
							socket.write(t.key+"\n");							
						}
						socket.write(".\n");
						db.close(function(err){});
					});
				});
			}
			
			// Quit
			// Desconecta al usuario del servidor
			if (data.indexOf("quit") === 0) {
				socket.end("Session terminated. Bye!\n");
			}
			
		}
	});
	
	// Cuando finaliza el amor
	socket.on("end", function() {
		console.log(socket.name+" disconnected");
	});
	
	// Si hay un error y no podemos usar el servidor 
	server.on('error', function (e) {
	  if (e.code == 'EADDRINUSE') {
	    console.log('Address in use, retrying...');
	    setTimeout(function () {
	      server.close();
	      server.listen(PORT, HOST);
	    }, 1000);
	  }
	});
	
});

server.listen(PORT, HOST);
console.log("Waiting for connections...");