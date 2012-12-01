// Servidor PerrySub con node.js
// (c) 2012 Nacho Lopez 

var net = require("net");
var fs = require("fs");
var nStore = require("nstore");
nStore = nStore.extend(require('nstore/query')());
var db_path = "data/";
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
				if (!fs.existsSync(db_path)) {
					fs.mkdirSync(db_path);
				}
			}
		} else {
			
			// El bucle principal del servidor			
			// Aceptamos comandos: dicts | dictcreate [x] | dictlist [x] | dictdel [x] | dictinsert [x] | dictremove [x] | quit
			
			// Dicts
			// Devuelve un listado de diccionarios. La última línea es un punto.
			if (data.indexOf("dicts") === 0) {
				var files = fs.readdirSync(db_path);
				for (var d in files) {
					socket.write(d.replace(".dict","")+"\n");
				}
				socket.write(".\n");
			}
			
			// DictCreate
			// Crea un nuevo diccionario (nueva base de datos)
			if (data.indexOf("dictcreate ") === 0) {
				var dictName = data.replace("dictcreate ","").replace("\n","").replace("\r","")+".dict";
				if (fs.existsSync(db_path+dictName)) {
					socket.write("That database already exists, skipping!\n");
				} else {
					console.log("Trying to create a new database: "+dictName);

					var terminology = nStore.new(db_path+dictName, function() {
						terminology.save("A key",{value:"An example value"}, function (err) {
							if (err) {
								console.log("Error saving database "+dictName);
							} else {
								console.log("Database created!");							
							}
						});
						
					});
				}
			}
			
			// DictList
			// Lista los terminos que hay en una base de datos
			if (data.indexOf("dictlist ") === 0) {
				var dictName = db_path+data.replace("dictlist ","").replace("\n","").replace("\r","")+".dict";
				console.log("Accessing (at least trying to) database: "+dictName);
				
				var terminology = nStore.new(db_path+dictName, function() {
					terminology.all(function(err,results){
						if (err) { 
							console.log("Error accessing database");
							return;
						}
					
						for (var r in results) {
							socket.write(r.value+"\n");
						}
						socket.write(".\n");
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