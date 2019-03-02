var Discord = require('discord.io');
var logger = require('winston');
var auth = require('./auth.json');
var xmlParser = require('xml2json');
var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;

var recentlyAddedMoviesSet = new Set();
var recentlyAddedShowsSet = new Set();

var monitoringMap = new Map();

// Configure logger settings
logger.remove(logger.transports.Console);
logger.add(new logger.transports.Console, {
    colorize: true
});
logger.level = 'debug';
// Initialize Discord Bot
var bot = new Discord.Client({
   token: auth.token,
   autorun: true
});

bot.on('ready', function (evt) {
    logger.info('Connected');
    logger.info('Logged in as: ');
    logger.info(bot.username + ' - (' + bot.id + ')');
});
bot.on('message', function (user, userID, channelID, message, evt) {
    // It will listen for messages that will start with `!`
    if (message.substring(0, 1) == '~') {
        var args = message.substring(1).split(' ');
        var cmd = args[0];
       
        args = args.splice(1);
        switch(cmd) {
            // !ping
            case 'ping':
                bot.sendMessage({
                    to: channelID,
                    message: 'Pong!'
                });
				break;
			case 'latest_movies':
				getRecentlyAddedMovies(channelID);
				break;
			case 'latest_shows':
				getRecentlyAddedShows(channelID);
				break;
			case 'start_monitor':
				startMonitoring(channelID);
				break;
			case 'stop_monitor':
				stopMonitoring(channelID);
				break;
			case 'help':
				bot.sendMessage({
					to: channelID,
					message: '**Welcome!** I am the Deep Media Plex Bot! My current duties are to provide recently added shows and movies.\n**Commands**\n*latest_movies* : Get information on the last 5 added movies\n*latest_shows* : Get information on the last 5 added episodes\n*start_monitor* : Starts monitoring the server. I will send messages whenever a new movie or show is added\n*stop_monitor* : Stops monitoring the server\n*planned_features* : Some quick information on what is planned to be added later as features for the Bot.'
				});
				break
			case 'planned_features':
				bot.sendMessage({
                    to: channelID,
                    message: '**Planned features for the this bot in the feature**\nCommands to look at latest episodes from a specific show and to be able to monitor new episodes only from a specific show.\nCommand to give a request of a movie or show to be added to the Plex Server'
                });
				break;
            break;
         }
     }
});


function getRecentlyAddedMovies(channelID) {
	var http = new XMLHttpRequest();
	var url = 'https://184-97-36-22.f42896105181455c8cdb2fdd51967b9f.plex.direct:29193/library/sections/1/all?type=1&sort=addedAt%3Adesc&includeCollections=1&X-Plex-Container-Start=0&X-Plex-Container-Size=5&X-Plex-Product=Plex%20Web&X-Plex-Version=3.89.2&X-Plex-Client-Identifier=4djmactnta6ycw2etoj47vyl&X-Plex-Platform=Chrome&X-Plex-Platform-Version=72.0&X-Plex-Sync-Version=2&X-Plex-Model=hosted&X-Plex-Device=Windows&X-Plex-Device-Name=Chrome&X-Plex-Device-Screen-Resolution=1920x937%2C1920x1080&X-Plex-Token=FxPMDqXtMHTQwADf2u4Z&X-Plex-Language=en&X-Plex-Text-Format=plain'
	http.open("GET", url);
	http.send();
	var firstTime = true
	http.onreadystatechange=function() {
		try{
			if(this.readyState==4 && this.status==200); {
				if(http.responseText && firstTime) {
					firstTime = false
					var responseJsonText = xmlParser.toJson(http.responseText);
					var responseJson = JSON.parse(responseJsonText);
					for(i = 0; i < responseJson['MediaContainer'].Video.length; i++) {
						var movie = responseJson['MediaContainer'].Video[i]
						bot.sendMessage({
							to: channelID,
							message: `----------------------------------------\n**Recently Added Movie** - ${movie.title}\n__*Year*__ : ${movie.year}\n__*Summary*__ : ${movie.summary}\n----------------------------------------`							
						});
					}
				}
			}
		} catch(err) {
			logger.info(err.message);
		}
	}
}

function getRecentlyAddedShows(channelID) {
	var http = new XMLHttpRequest();
	var url = 'https://184-97-36-22.f42896105181455c8cdb2fdd51967b9f.plex.direct:29193/hubs/home/recentlyAdded?type=2&X-Plex-Container-Start=0&X-Plex-Container-Size=10&X-Plex-Product=Plex%20Web&X-Plex-Version=3.89.2&X-Plex-Client-Identifier=4djmactnta6ycw2etoj47vyl&X-Plex-Platform=Chrome&X-Plex-Platform-Version=72.0&X-Plex-Sync-Version=2&X-Plex-Model=hosted&X-Plex-Device=Windows&X-Plex-Device-Name=Chrome&X-Plex-Device-Screen-Resolution=1221x937%2C1920x1080&X-Plex-Token=FxPMDqXtMHTQwADf2u4Z&X-Plex-Language=en&X-Plex-Text-Format=plain'
	http.open("GET", url);
	http.send();
	var firstTime = true
	http.onreadystatechange=function() {
		try {
			if(this.readyState==4 && this.status==200); {
				if(http.responseText && firstTime) {
					firstTime = false
					var responseJsonText = xmlParser.toJson(http.responseText);
					var responseJson = JSON.parse(responseJsonText);
					for(i = 0; i < responseJson['MediaContainer'].Video.length; i++) {
						var show = responseJson['MediaContainer'].Video[i]
						bot.sendMessage({
							to: channelID,
							message: `----------------------------------------\n**Recently Added Episode** - ${show.grandparentTitle}\n__*Title*__ : ${show.title}\n__*Season*__ : ${show.parentTitle}\n__*Summary*__ : ${show.summary}\n----------------------------------------`							
						});
					}
				}
			}
		} catch(err) {
			logger.info(err.message);
		} 
	}
}

function startMonitoring(channelID) {
	if(!monitoringMap.has(channelID)) {
		fillRecentMovieSet();
		fillRecentShowSet();
		monitoringMap[channelID] = setInterval(function(){monitorShowsAndMovies(channelID)}, 3000);
		bot.sendMessage({
			to: channelID,
			message: 'Now monitoring Plex server for newly added movies and shows.'
		});	
	} else {
		bot.sendMessage({
			to: channelID,
			message: 'Monitoring for Plex server has already been started.'
		});
	}
}

function stopMonitoring(channelID) {
	if(monitoringMap.has(channelID)) {
		clearInterval(monitoringMap[channelID]);
		monitoringMap.delete(channelID);
		bot.sendMessage({
			to: channelID,
			message: 'Monitoring for Plex server has stopped.'
		});
	} else {
		bot.sendMessage({
			to: channelID,
			message: 'Monitoring for Plex server is already stopped.'
		});
	}
}


function monitorShowsAndMovies(channelID) {
	checkRecentMovies(channelID);
	checkRecentTvshows(channelID);
}

function checkRecentMovies(channelID) {
	var http = new XMLHttpRequest();
	var url = 'https://184-97-36-22.f42896105181455c8cdb2fdd51967b9f.plex.direct:29193/library/sections/1/all?type=1&sort=addedAt%3Adesc&includeCollections=1&X-Plex-Container-Start=0&X-Plex-Container-Size=5&X-Plex-Product=Plex%20Web&X-Plex-Version=3.89.2&X-Plex-Client-Identifier=4djmactnta6ycw2etoj47vyl&X-Plex-Platform=Chrome&X-Plex-Platform-Version=72.0&X-Plex-Sync-Version=2&X-Plex-Model=hosted&X-Plex-Device=Windows&X-Plex-Device-Name=Chrome&X-Plex-Device-Screen-Resolution=1920x937%2C1920x1080&X-Plex-Token=FxPMDqXtMHTQwADf2u4Z&X-Plex-Language=en&X-Plex-Text-Format=plain'
	http.open("GET", url);
	http.send();
	var firstTime = true
	http.onreadystatechange=function() {
		try {
			if(this.readyState==4 && this.status==200); {
				if(http.responseText && firstTime) {
					firstTime = false
					var responseJsonText = xmlParser.toJson(http.responseText);
					var responseJson = JSON.parse(responseJsonText);
					var newMovieSet = new Set();
					var allMovies = new Set();
					for(i = 0; i < responseJson['MediaContainer'].Video.size; i++) {
						if(!recentlyAddedMoviesSet.has(responseJson['MediaContainer'].Video[i].title)) {
							newMovieSet.add(responseJson['MediaContainer'].Video[i]);
						}
						allMovies.add(responseJson['MediaContainer'].Video[i].title);
					}
					if (newMovieSet.size > 0) {
						for (movie of newMovieSet.values()) {
							bot.sendMessage({
								to: channelID,
								message: `----------------------------------------\n**Movie Added** - ${movie.title}\n__*Year*__ : ${movie.year}\n__*Summary*__ : ${movie.summary}\n----------------------------------------`							
							});
						}
					}
					recentlyAddedMoviesSet = allMovies;
				}
			}
		} catch(err) {
			logger.info(err.message);
		}
	}
}

function checkRecentTvshows(channelID) {
	var http = new XMLHttpRequest();
	var url = 'https://184-97-36-22.f42896105181455c8cdb2fdd51967b9f.plex.direct:29193/hubs/home/recentlyAdded?type=2&X-Plex-Container-Start=0&X-Plex-Container-Size=10&X-Plex-Product=Plex%20Web&X-Plex-Version=3.89.2&X-Plex-Client-Identifier=4djmactnta6ycw2etoj47vyl&X-Plex-Platform=Chrome&X-Plex-Platform-Version=72.0&X-Plex-Sync-Version=2&X-Plex-Model=hosted&X-Plex-Device=Windows&X-Plex-Device-Name=Chrome&X-Plex-Device-Screen-Resolution=1221x937%2C1920x1080&X-Plex-Token=FxPMDqXtMHTQwADf2u4Z&X-Plex-Language=en&X-Plex-Text-Format=plain'
	http.open("GET", url);
	http.send();
	var firstTime = true
	http.onreadystatechange=function() {
		try {
			if(this.readyState==4 && this.status==200); {
				if(http.responseText && firstTime) {
					firstTime = false
					var responseJsonText = xmlParser.toJson(http.responseText);
					var responseJson = JSON.parse(responseJsonText);
					var newShowSet = new Set();
					var allShows = new Set();
					for(i = 0; i < responseJson['MediaContainer'].Video.size; i++) {
						if(!recentlyAddedShowsSet.has(responseJson['MediaContainer'].Video[i].title)) {
							newShowSet.add(responseJson['MediaContainer'].Video[i]);
						}
						allShows.add(responseJson['MediaContainer'].Video[i].title);
					}
					if (newShowSet.size > 0) {
						for (show of newShowSet.values()) {
							bot.sendMessage({
								to: channelID,
								message: `----------------------------------------\n**New Episode Added** - ${show.grandparentTitle}\n__*Title*__ : ${show.title}\n__*Season*__ : ${show.parentTitle}\n__*Summary*__ : ${show.summary}\n----------------------------------------`							
							});
						}
					}
					recentlyAddedShowsSet = allShows;
				}
			}
		} catch(err) {
			logger.info(err.message);
		}
	}
}

function fillRecentMovieSet() {
	var http = new XMLHttpRequest();
	var url = 'https://184-97-36-22.f42896105181455c8cdb2fdd51967b9f.plex.direct:29193/library/sections/1/all?type=1&sort=addedAt%3Adesc&includeCollections=1&X-Plex-Container-Start=0&X-Plex-Container-Size=5&X-Plex-Product=Plex%20Web&X-Plex-Version=3.89.2&X-Plex-Client-Identifier=4djmactnta6ycw2etoj47vyl&X-Plex-Platform=Chrome&X-Plex-Platform-Version=72.0&X-Plex-Sync-Version=2&X-Plex-Model=hosted&X-Plex-Device=Windows&X-Plex-Device-Name=Chrome&X-Plex-Device-Screen-Resolution=1920x937%2C1920x1080&X-Plex-Token=FxPMDqXtMHTQwADf2u4Z&X-Plex-Language=en&X-Plex-Text-Format=plain'
	http.open("GET", url);
	http.send();
	var firstTime = true
	http.onreadystatechange=function() {
		try {
			if(this.readyState==4 && this.status==200); {
				if(http.responseText && firstTime) {
					firstTime = false
					var responseJsonText = xmlParser.toJson(http.responseText);
					var responseJson = JSON.parse(responseJsonText);
					var allMovies = new Set();
					for(i = 0; i < responseJson['MediaContainer'].Video.size; i++) {
						allMovies.add(responseJson['MediaContainer'].Video[i].title);
					}
					recentlyAddedMoviesSet = allMovies;
				}
			}
		} catch(err) {
			logger.info(err.message);
		}
	}
}

function fillRecentShowSet() {
	var http = new XMLHttpRequest();
	var url = 'https://184-97-36-22.f42896105181455c8cdb2fdd51967b9f.plex.direct:29193/hubs/home/recentlyAdded?type=2&X-Plex-Container-Start=0&X-Plex-Container-Size=10&X-Plex-Product=Plex%20Web&X-Plex-Version=3.89.2&X-Plex-Client-Identifier=4djmactnta6ycw2etoj47vyl&X-Plex-Platform=Chrome&X-Plex-Platform-Version=72.0&X-Plex-Sync-Version=2&X-Plex-Model=hosted&X-Plex-Device=Windows&X-Plex-Device-Name=Chrome&X-Plex-Device-Screen-Resolution=1221x937%2C1920x1080&X-Plex-Token=FxPMDqXtMHTQwADf2u4Z&X-Plex-Language=en&X-Plex-Text-Format=plain'
	http.open("GET", url);
	http.send();
	var firstTime = true
	http.onreadystatechange=function() {
		try{ 
			if(this.readyState==4 && this.status==200); {
				if(http.responseText && firstTime) {
					firstTime = false
					var responseJsonText = xmlParser.toJson(http.responseText);
					var responseJson = JSON.parse(responseJsonText);
					var allShows = new Set();
					for(i = 0; i < responseJson['MediaContainer'].Video.size; i++) {
						allShows.add(responseJson['MediaContainer'].Video[i].title);
					}
					recentlyAddedShowsSet = allShows;
				}
			}
		} catch(err) {
			logger.info(err.message);
		}
	}
}