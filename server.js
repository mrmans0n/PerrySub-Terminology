// Servidor PerrySub con node.js
// (c) 2012 Nacho Lopez 

var net = require("net");
var fs = require("fs");
var redis = require("redis");
var HOST = "127.0.0.1";
var PORT = 26108;
var HANDSHAKE = "mrmr0x";

var server = net.createServer(function(socket) {

	var redisClient = redis.createClient();

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
				redisClient.get("perrysub_dicts", function(err, reply) {
					console.log(reply);
					if (reply != null) {
						var dicts = JSON.parse(reply);
						for (var i=0; i<dicts.length; i++) {
							socket.write(dicts[i]+"\n");
						}
					}
					socket.write(".\n");					
				});
			}
			
			// DictCreate
			// Crea un nuevo diccionario (nueva base de datos)
			if (data.indexOf("dictcreate ") === 0) {
				var dictName = data.replace("dictcreate ","").replace("\n","").replace("\r","");
				
				redisClient.get("perrysub_dicts", function(err, reply) {
					var dicts = new Array();
					if (reply != null) {
						dicts = JSON.parse(reply);
					}
					dicts.push(dictName);
					redisClient.set("perrysub_dicts", JSON.stringify(dicts), redis.print);					
				});
				
			}
			
			// DictList
			// Lista los terminos que hay en una base de datos
			if (data.indexOf("dictlist ") === 0) {
				var dictName = data.replace("dictlist ","").replace("\n","").replace("\r","");
				console.log("Accessing (at least trying to) database: "+dictName);
				
				redisClient.get(dictName, function(err, reply) {
					console.log(reply);
					if (reply != null) {
						var hash = JSON.parse(reply);
						for (var i=0; i<dicts.length; i++) {
							socket.write(dicts[i]+"\n");
						}
					}
				});				
			}
			
			// DictDel
			// Elimina una base de datos
			if (data.indexOf("dictdel ") === 0) {
				var dictName = data.replace("dictdel ","").replace("\n","").replace("\r","");
				console.log("Removing (at least trying to) database: "+dictName);
				
				redisClient.del(dictName, function(err) {
					console.log("There was an error deleting "+dictName);
					console.log(err);
				});
				
				redisClient.get("perrysub_dicts", function(err, reply) {
					if (reply != null) {
						var dicts = JSON.parse(reply);
						var newDicts = new Array();
						for (var i=0; i<dicts.length; i++) {
							if (dicts[i] != dictName) newDicts.push(dicts[i]);
						}
						console.log(newDicts);
						redisClient.set("perrysub_dicts", JSON.stringify(newDicts), redis.print);
					}
				});
			}
			
			// DictInsert
			// Inserta un termino en una base de datos
			if (data.indexOf("dictinsert ") === 0) {
				// TODO
			}
			
			// DictRemove
			// Elimina un termino de una base de datos
			if (data.indexOf("dictremove ") === 0) {
				// TODO
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
		redisClient.quit();
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