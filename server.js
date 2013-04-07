// Servidor PerrySub con node.js
// (c) 2012-2013 Nacho Lopez 

var net = require("net");
var fs = require("fs");

if (process.env.REDISTOGO_URL) {
	var rtg   = require("url").parse(process.env.REDISTOGO_URL);
	var redis = require("redis").createClient(rtg.port, rtg.hostname);
	redis.auth(rtg.auth.split(":")[1]);	
} else {
	var redis = require("redis").createClient();	
}

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
				redis.get("perrysub_dicts", function(err, reply) {
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
				
				redis.get("perrysub_dicts", function(err, reply) {
					var dicts = new Array();
					if (reply != null) {
						dicts = JSON.parse(reply);
					}
					dicts.push(dictName);
					redis.set("perrysub_dicts", JSON.stringify(dicts), redis.print);	
					redis.set(dictName, JSON.stringify(new Object()), redis.print);				
				});
				
			}
			
			// DictList
			// Lista los terminos que hay en una base de datos
			if (data.indexOf("dictlist ") === 0) {
				var dictName = data.replace("dictlist ","").replace("\n","").replace("\r","");
				console.log("Accessing (at least trying to) database: "+dictName);
				
				redis.get(dictName, function(err, reply) {
					console.log(reply);
					if (reply != null) {
						var hash = JSON.parse(reply);
						for (var key in hash) {
							socket.write(key+":"+hash[key]+"\n");
						}
					}
				});				
			}
			
			// DictDel
			// Elimina una base de datos
			if (data.indexOf("dictdel ") === 0) {
				var dictName = data.replace("dictdel ","").replace("\n","").replace("\r","");
				console.log("Removing (at least trying to) database: "+dictName);
				
				redis.del(dictName, function(err) {
					console.log("There was an error deleting "+dictName);
					console.log(err);
				});
				
				redis.get("perrysub_dicts", function(err, reply) {
					if (reply != null) {
						var dicts = JSON.parse(reply);
						var newDicts = new Array();
						for (var i=0; i<dicts.length; i++) {
							if (dicts[i] != dictName) newDicts.push(dicts[i]);
						}
						console.log(newDicts);
						redis.set("perrysub_dicts", JSON.stringify(newDicts), redis.print);
					}
				});
			}
			
			// DictInsert
			// Inserta un termino en una base de datos
			if (data.indexOf("dictinsert ") === 0) {
				var paramsArray = data.split(",");
				if (paramsArray.length == 2) {
					var dictName = paramsArray[0].replace("dictinsert ","").replace("\n","").replace("\r","");					
					var keyValue = paramsArray[1].split(": ");
					if (keyValue.length == 2) {
						var key = keyValue[0].replace("\n","").replace("\r","");;
						var value = keyValue[1].replace("\n","").replace("\r","");;
						
						console.log("key = "+key);
						console.log("value = "+value);
						
						console.log("Accessing (at least trying to) database: "+dictName);
				
						redis.get(dictName, function(err, reply) {
							console.log(reply);
							if (reply != null) {
								var hash = JSON.parse(reply);
								if (hash==null) hash = new Object();
								hash[key] = value;
								redis.set(dictName, JSON.stringify(hash), redis.print);
							}
						});	
					}
				}
			}
			
			// DictRemove
			// Elimina un termino de una base de datos
			if (data.indexOf("dictremove ") === 0) {
				var paramsArray = data.split(",");
				if (paramsArray.length == 2) {
					var dictName = paramsArray[0].replace("dictremove ","").replace("\n","").replace("\r","");					
					var termName = paramsArray[1].replace("\n","").replace("\r","");
					
					console.log("Accessing (at least trying to) database: "+dictName);
				
					redis.get(dictName, function(err, reply) {
						console.log(reply);
						if (reply != null) {
							var hash = JSON.parse(reply);
							if (hash==null) hash = new Object();
							delete hash[termName];
							redis.set(dictName, JSON.stringify(hash), redis.print);
						}
					});	
				} else {
					console.log("You are doing it wrong: "+data);
				}
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
		redis.quit();
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