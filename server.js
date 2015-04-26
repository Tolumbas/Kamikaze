var app = require('http').createServer(handler)
var io = require('socket.io')(app);
var fs = require('fs');
app.listen(80);

function handler (req, res) {
  fs.readFile(__dirname + '/kamikaze.html',
  function (err, data) {
    if (err) {
      res.writeHead(500);
      return res.end('Error loading index.html');
	}

    res.writeHead(200);
    res.end(data);
  });
}
/*
var antiSpam = require('socket-anti-spam');
var antiSpam = new antiSpam({
    spamCheckInterval: 1000,
    spamMinusPointsPerInterval: 1,
    spamMaxPointsBeforeKick: 9,
    spamEnableTempBan: false,
    spamKicksBeforeTempBan: 3,
    spamTempBanInMinutes: 10,
    removeKickCountAfter: 1,
    debug: false
});*/

var players = [];
var bullets = [];
var timer =0;
var arena = {width:3000,height:3000};

function searchid(id){
		var a=0;
		for (a;a<players.length;a++){
			if (players[a].id == id)break;
		}
		return a;
	}
function randcol(){
	return "hsl("+Math.round(Math.random()*360) + ",100%,50%)";
}
function player(id){
	this.x = arena.width*Math.random();
	this.y = arena.height*Math.random();
	this.ax =0;
	this.ay =0;
	this.size = 10;
	this.color = randcol();
	
	this.keyA=false;
	this.keyS=false;
	this.keyD=false;
	this.keyW=false;
	
	this.kills=0;
	this.assists=0;
	this.deaths=0;
	
	this.life=100;
	this.ingame=true;
	this.cooldown=0;
	
	this.id=id;
}
function dist(x,y){
	return Math.sqrt(x*x+y*y);
}

function update(){
	for (var a=0;a<players.length;a++){
		if (!players[a].ingame)continue;
		if (players[a].keyA){players[a].ax-=0.3;}
		if (players[a].keyS){players[a].ay+=0.3;}
		if (players[a].keyD){players[a].ax+=0.3;}
		if (players[a].keyW){players[a].ay-=0.3;}
		
		if (players[a].x+10>arena.width){players[a].x=arena.width-10;players[a].ax*=-1;}
		if (players[a].x-10<0){players[a].x=10;players[a].ax*=-1;}
			
		if (players[a].y+10>arena.height){players[a].y=arena.height-10;players[a].ay*=-1;}
		if (players[a].y-10<0){players[a].y=10;players[a].ay*=-1;}
			
		players[a].ax*=0.95;
		players[a].ay*=0.95;
			
		players[a].x+=players[a].ax;
		players[a].y+=players[a].ay;

		
		if(players[a].cooldown>0){players[a].cooldown--;}
		
		for (var b=0;b<bullets.length;b++){
			if (dist(players[a].x-bullets[b].x,players[a].y-bullets[b].y)<15 && players[a].id != bullets[b].id){
				players[a].life -=29;
				
				if(players[a].life<0){
					players[searchid(bullets[b].id)].kills++;
					io.emit("playerkilled",players[a].id);
					
					players[a].ingame = false;
					console.log("player killed");
				}
				
				bullets.splice(b,1);
			}
		}
	}
	for (var a=0;a<bullets.length;a++){
		bullets[a].x+=bullets[a].ax;
		bullets[a].y+=bullets[a].ay;
		bullets[a].life--;
		
		if(bullets[a].x>arena.width || bullets[a].x<0 || bullets[a].y<0 || bullets[a].y>arena.height || bullets[a].life<0){
			bullets.splice(a,1);
		}
	}
	if (timer%3 == 0)io.emit("update",{players:players,bullets:bullets});
	timer++;
	setTimeout(update, 10);
}

update();

io.on('connection', function (socket) {
	
	console.log("New Player! Num players:",players.length+1);
	//antiSpam.onConnect(socket); 
	players.push(new player(socket.id));
	var data = {players:players,bullets:bullets,id:socket.id};
	
	
	socket.emit("hello",data);
	
	socket.on("keyAdown",function(){players[searchid(socket.id)].keyA=true;});
	socket.on("keySdown",function(){players[searchid(socket.id)].keyS=true;});
	socket.on("keyDdown",function(){players[searchid(socket.id)].keyD=true;});
	socket.on("keyWdown",function(){players[searchid(socket.id)].keyW=true;});
	
	socket.on("keyAup",function(){players[searchid(socket.id)].keyA=false;});
	socket.on("keySup",function(){players[searchid(socket.id)].keyS=false;});
	socket.on("keyDup",function(){players[searchid(socket.id)].keyD=false;});
	socket.on("keyWup",function(){players[searchid(socket.id)].keyW=false;});
	
	socket.on("respawn",function (){
		var kid = searchid(socket.id);
		if (!players[kid].ingame){
			players[kid].x = arena.width*Math.random();
			players[kid].y = arena.height*Math.random();
			players[kid].deaths ++;
			players[kid].life = 100;
			players[kid].ingame = true;
		}
		console.log("respawned");
		
	});
	
	socket.on("fire",function(args){
		kid=searchid(socket.id);
		if (players[kid].cooldown==0 && players[kid].ingame){
			
			players[kid].cooldown = 7;
			
			bullets.push({
				id:socket.id,
				life:150,
				size:5,
				x:players[kid].x,
				y:players[kid].y,
				ax:-Math.cos(args)*7,
				ay:-Math.sin(args)*7,
				color:players[kid].color
			});
		}
	});
	
	socket.on('disconnect', function(){
		for (var a=0;a<players.length;a++){
		if (players[a].id == socket.id)players.splice(a,1);
		}
		console.log('user disconnected');
	});
	
});