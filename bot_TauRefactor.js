var Discord = require('discord.io');
var logger = require('winston');
var auth = require('./auth.json');
var https = require('http');

var oldMovies = new Set();
var oldShows = new Set();

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
				showRecentlyAddedMovies(channelID);
				break;
			case 'latest_shows':
				showRecentlyAddedShows(channelID);
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

function doAPICall(command, callback) {
	https.get(`http://[host]:[port]/api/v2?apikey=[ADD API KEY]&cmd=${command}`, (resp) => {
		let data = "";
		
		resp.on('data', (chunk) => {
			data += chunk;
		});
		
		resp.on('end', () => {
			logger.info(data);
			logger.info("help");
			return callback(JSON.parse(data));
		});
	}).on("error", (err) => {
		logger.error(err.message);
	});
}

function startMonitoring(channelID) {
	if(!monitoringMap.has(channelID)) {
		getRecentlyAddedMovies(function(movies)) {oldMovies = movies};
		getRecentlyAddedShows(function(shows)) {oldShows = shows};
		monitoringMap[channelID] = setInterval(function(){monitoringAction(channelID)}, 3000);
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

function showRecentlyAddedMovies(channelID) {
	getRecentlyAddedMovies(function(movies) {
		movies.forEach(function(movie) {
			logger.info("second")
			bot.sendMessage({
				to: channelID,
				message: `----------------------------------------\n**Recently Added Movie** - ${movie.title}\n__*Year*__ : ${movie.year}\n__*Summary*__ : ${movie.summary}\n----------------------------------------`							
			});
		});
	});
}

function showRecentlyAddedShows(channelID) {
	getRecentlyAddedShows(function(shows) {
		shows.forEach(function(show) {
			bot.sendMessage({
				to: channelID,
				message: `----------------------------------------\n**Recently Added Episode** - ${show.grandparentTitle}\n__*Title*__ : ${show.title}\n__*Season*__ : ${show.parentTitle}\n__*Summary*__ : ${show.summary}\n----------------------------------------`							
			});
		});
	});
}

function monitoringAction(channelID) {
	var newMovies = checkRecentMovies();
	var newShows = checkRecentShows();
	
	newMovies.forEach(function(movie) {
		bot.sendMessage({
			to: channelID,
			message: `----------------------------------------\n**Movie Added** - ${movie.title}\n__*Year*__ : ${movie.year}\n__*Summary*__ : ${movie.summary}\n----------------------------------------`							
		});
	});
	newShows.forEach(function(show) {
		bot.sendMessage({
			to: channelID,
			message: `----------------------------------------\n**New Episode Added** - ${show.grandparentTitle}\n__*Title*__ : ${show.title}\n__*Season*__ : ${show.parentTitle}\n__*Summary*__ : ${show.summary}\n----------------------------------------`							
		});
	});
}

function checkRecentMovies() {
	var movies = getRecentlyAddedMovies();
	var newMovies = compareAndGetNewElements(oldMovies, movies);
	oldMovies = movies;
	return newMovies;
}

function checkRecentShows() {
	var shows = getRecentlyAddedShows();
	var newShows = compareAndGetNewElements(oldShows, shows);
	oldShows = shows;
	return newShows;
}

function getRecentlyAddedMovies(callback) {
	doAPICall('get_recently_added&count=20&media_type=movie', function(jsonResult) {
		var movies = new Set();
		logger.info(jsonResult);
		jsonResult.response.data.recently_added.forEach(function(movie) {movies.add(movie);});
		return callback(movies);
	});
}

function getRecentlyAddedShows(callback) {
	doAPICall('get_recently_added&count=20&media_type=movie', function(jsonResult) {
		var shows = new Set();
		jsonResult.recently_added.forEach(function(show) {movies.add(show);});
		return callback(shows)
	});
}

function compareAndGetNewElements(oldSet, newSet) {
	var newElements = new List();
	newSet.forEach(function(e) {
		var oldElement = oldSet.filter(oldE => (oldE.rating_key === e.rating_key));
		if (oldElement == null) {
			newElements.add(e);
		}
	});
	return newElements;
}

//function home_stats(channelID) {
//	var jsonResult = doAPICall('get_home_stats');
//	
//}