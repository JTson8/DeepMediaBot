var Discord = require('discord.io');
var logger = require('winston');
var nodemailer = require("nodemailer");
var auth = require('./auth.json');
var apiResource = require('./apiResource.js')

var transporter = nodemailer.createTransport({
	service: 'gmail',
	auth: {
		user: auth.email,
		pass: auth.emailpass
	}
});

var oldMovies = new Set();
var oldShows = new Set();

var monitoringChannels = new Set();
var monitoringEmails = new Set();

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
	//setInterval(function(){monitoringAction()}, 1000*60*60);
	setInterval(function(){monitoringAction()}, 3000);
});
bot.on('message', function (user, userID, channelID, message, evt) {
    // It will listen for messages that will start with `!`
    if (message.substring(0, 1) == '~') {
        var args = message.substring(1).split(' ');
        var cmd = args[0];
		
		args = args.splice(1);
        switch(cmd) {
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
			case 'subscribe':
				subscribe(channelID, args.join(' '));
				break
			case 'unsubscribe':
				unsubscribe(channelID, args.join(' '));
				break
			case 'help':
				bot.sendMessage({
					to: channelID,
					message: '**Welcome!** I am the Deep Media Plex Bot! My current duties are to provide recently added shows and movies.\n**Commands** - Start with \'~\'\n*latest_movies* : Get information on the last 5 added movies\n*latest_shows* : Get information on the last 5 added episodes\n*start_monitor* : Starts monitoring the server. I will send messages whenever a new movie or show is added\n*stop_monitor* : Stops monitoring the server\n*report [alltime, day, week, month]* : Gives a stat report within the given time frame\n*user_stats [username]* : Gives stats on the given user\n*user* : Gives list of all users and their ids'
				});
				break
			case 'report':
				if(args.length != 0) {
					showReport(channelID, args[0]);
				} else {
					showReport(channelID, "alltime");
				}
				break
			case 'user_stats':
				showUserStats(channelID, args.join(' '));
				break
			case 'users':
				showUsers(channelID);
				break
            break;
         }
     }
});

function startMonitoring(channelID) {
	if(!monitoringChannels.has(channelID)) {
		monitoringChannels.add(channelID);
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
	if(monitoringChannels.has(channelID)) {
		monitoringChannels.delete(channelID);
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

function subscribe(channelID, email) {
	if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
		if(!monitoringEmails.has(email)) {
			monitoringEmails.add(email);
			bot.sendMessage({
				to: channelID,
				message: `${email} is now subscribed to Plex sever!`
			});	
		} else {
			bot.sendMessage({
				to: channelID,
				message: 'Already subscribed to Plex server.'
			});
		}
	} else {
		bot.sendMessage({
			to: channelID,
			message: 'Invalid email address.'
		});
	}
}

function unsubscribe(channelID, email) {
	if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
		if(monitoringEmails.has(email)) {
			monitoringEmails.delete(email);
			bot.sendMessage({
				to: channelID,
				message: `${email} has now been unsubscribed from Plex sever!`
			});	
		} else {
			bot.sendMessage({
				to: channelID,
				message: 'Already unsubscribed from Plex server.'
			});
		}
	} else {
		bot.sendMessage({
			to: channelID,
			message: 'Invalid email address.'
		});
	}
}

function showRecentlyAddedMovies(channelID) {
	apiResource.getRecentlyAddedMovies(function(movies) {
		movies.forEach(function(movie) {
			bot.sendMessage({
				to: channelID,
				message: `----------------------------------------\n**Recently Added Movie** - ${movie.title}\n__*Year*__ : ${movie.year}\n__*Summary*__ : ${movie.summary}\n----------------------------------------`							
			});
		});
	});
}

function showRecentlyAddedShows(channelID) {
	apiResource.getRecentlyAddedShows(function(shows) {
		shows.forEach(function(show) {
			if (show.grandparent_title == "") {
				bot.sendMessage({
					to: channelID,
					message: `----------------------------------------\n**Recently Added Series** - ${show.parent_title}\n__*Season*__ : ${show.title}\n----------------------------------------`							
				});
			} else {
				bot.sendMessage({
					to: channelID,
					message: `----------------------------------------\n**Recently Added Episode** - ${show.grandparent_title}\n__*Title*__ : ${show.title}\n__*Season*__ : ${show.parent_title}\n__*Summary*__ : ${show.summary}\n----------------------------------------`							
				});
			}
		});
	});
}

function showReport(channelID, timeFrame) {
	var days = 0;
	var reportType = "All Time";
	if (timeFrame == "day") { 
		days = 1;
		reportType = "Daily"; 
	}
	else if (timeFrame == "week") {
		days = 7;
		reportType + "Weekly";
	}
	else if (timeFrame == "month") {
		days = 30;
		reportType = "Monthly";
	}
	apiResource.home_stats(days, function(stats_map) {
		var topMoviesMsg = "---------- Top Movies ----------\n";
		stats_map.get('topMovies').forEach(function(movie) {
			topMoviesMsg += `${movie.title} - Total Plays: ${movie.total_plays}\n`
		});
		topMoviesMsg += "--------------------------------\n";
		
		var popMoviesMsg = "---------- Popular Movies ----------\n";
		stats_map.get('popularMovies').forEach(function(movie) {
			popMoviesMsg += `${movie.title} - Number Users Watched: ${movie.users_watched}\n`
		});
		popMoviesMsg += "-------------------------------------\n";
		
		var topShowsMsg = "---------- Top Shows ----------\n";
		stats_map.get('topShows').forEach(function(show) {
			topShowsMsg += `${show.title} - Total Plays: ${show.total_plays}\n`
		});
		topShowsMsg += "-------------------------------------\n";
		
		var popShowsMsg = "---------- Popular Shows ----------\n";
		stats_map.get('popularShows').forEach(function(show) {
			popShowsMsg += `${show.title} - Number Users Watched: ${show.users_watched}\n`
		});
		popShowsMsg += "-------------------------------------\n"
		
		var topUsersMsg = "---------- Top Users -----------\n";
		stats_map.get('topUsers').forEach(function(user) {
			topUsersMsg += `${user.friendly_name} - Total Plays: ${user.total_plays}, Time Spent: ${user.total_duration}\n`
		});
		topUsersMsg += "-------------------------------------\n"
		bot.sendMessage({
			to: channelID,
			message: `${topMoviesMsg}`							
		});
		bot.sendMessage({
			to: channelID,
			message: `${popMoviesMsg}\n`							
		});
		bot.sendMessage({
			to: channelID,
			message: `${topShowsMsg}`							
		});
		bot.sendMessage({
			to: channelID,
			message: `${popShowsMsg}\n`							
		});
		bot.sendMessage({
			to: channelID,
			message: `${topUsersMsg}\n`							
		});
	});
}

function showUserStats(channelID, username) {
	apiResource.user_stats(username, function(statsMap) {
		if (statsMap.size == 0) {
			bot.sendMessage({
				to: channelID,
				message: `User ${username} does not exist`							
			});
		} else {
			var dayMsg = `Last 24 hours : Total Time - ${statsMap.get('dailyWatch').total_time}, Total Plays - ${statsMap.get('dailyWatch').total_plays}\n`;
			var weekMsg = `Last 7 days : Total Time - ${statsMap.get('weeklyWatch').total_time}, Total Plays - ${statsMap.get('weeklyWatch').total_plays}\n`;
			var monthMsg = `Last 30 days : Total Time - ${statsMap.get('monthlylWatch').total_time}, Total Plays - ${statsMap.get('monthlylWatch').total_plays}\n`;
			var allTimeMsg = `All Time : Total Time - ${statsMap.get('allTimeWatch').total_time}, Total Plays - ${statsMap.get('allTimeWatch').total_plays}\n`;
			var lastWatchedMsg = `Last 3 Watched: \n`
			statsMap.get('lastWatched').forEach(function(data) {
				lastWatchedMsg += `\tTitle: ${data.last_played}, Player: ${data.player}\n`
			});
			bot.sendMessage({
				to: channelID,
				message: `---------- User Stats for ${username} ----------\n${dayMsg}${weekMsg}${monthMsg}${allTimeMsg}${lastWatchedMsg}------------------------------`							
			});
		}
	});
}

function showUsers(channelID) {
	apiResource.getUsers(function(users) {
		var usersMsg = "";
		users.forEach(function(user) {
			usersMsg += `Username: ${user.friendly_name}, UserId: ${user.user_id}\n`
		});
		bot.sendMessage({
				to: channelID,
				message: usersMsg							
			});
	});
}

function monitoringAction() {
	logger.info('monitoring')
	checkRecentMovies(function(newMovies) {
		newMovies.forEach(function(movie) {
			monitoringChannels.forEach(function(channelID) {
				bot.sendMessage({
					to: channelID,
					message: `----------------------------------------\n**Movie Added** - ${movie.title}\n__*Year*__ : ${movie.year}\n__*Summary*__ : ${movie.summary}\n----------------------------------------`							
				});
			});
		});
		checkRecentShows(function(newShows) {
			newShows.forEach(function(show) {
				monitoringChannels.forEach(function(channelID) {
					if (show.grandparent_title == "") {
						bot.sendMessage({
							to: channelID,
							message: `----------------------------------------\n**New Series Added** - ${show.parent_title}\n__*Season*__ : ${show.title}\n----------------------------------------`							
						});
					} else {
						bot.sendMessage({
							to: channelID,
							message: `----------------------------------------\n**New Episode Added** - ${show.grandparent_title}\n__*Title*__ : ${show.title}\n__*Season*__ : ${show.parent_title}\n__*Summary*__ : ${show.summary}\n----------------------------------------`							
						});
					}
				});
			});
			createMailOptions(newMovies, newShows, function(mailOptions) {
				logger.info('mail')
				transporter.sendMail(mailOptions, function (err, info) {
				   if(err)
					 console.log(err)
				   else
					 console.log(info);
				});
			});
		});
	});
}

function checkRecentMovies(callback) {
	apiResource.getRecentlyAddedMovies(function(movies) {
		var newMovies = compareAndGetNewElements(oldMovies, movies);
		oldMovies = movies;
		return callback(oldMovies);
	});
}

function checkRecentShows(callback) {
	apiResource.getRecentlyAddedShows(function(shows) {
		var newShows = compareAndGetNewElements(oldShows, shows);
		oldShows = shows;
		return callback(oldShows);
	});
}

function compareAndGetNewElements(oldSet, newSet) {
	var newElements = new Set();
	newSet.forEach(function(e) {
		var oldElement = null;
		oldSet.forEach(function(oldE) {
			if (oldE.rating_key == e.rating_key) {
				oldElement = oldE;
			}
		});
		if (oldElement == null) {
			newElements.add(e);
		}
	});
	return newElements;
}

function createMailOptions(movies, shows, callback) {
	var recipients = "";
	monitoringEmails.forEach(function(email) {
		recipients = recipients.concat(email, ',');
	});
	recipients = recipients.slice(0, -1);
	
	movieSection = "<h3>New Movies</h3>";
	movies.forEach(function(movie) {
		var string = `<div><h5>${movie.title} - ${movie.year}</h5><p>${movie.summary}</p></div>`;
		movieSection = movieSection.concat(string);
	});
	
	showSection = "<h3>New Series</h3>";
	episodeSection = "<h3>New Episodes</h3>";
	shows.forEach(function(show) {
		if (show.grandparent_title == "") {
			var string = `<div><h5>${show.parent_title}</h5><p>Season: ${show.title}</p></div>`;
			showSection = showSection.concat(string);
		} else {
			var string = `<div><h5${show.grandparent_title} - ${show.title}</h5><p>Season: ${show.parent_title}<br />${show.summary}</p></div>`;
			episodeSection = episodeSection.concat(string);
		}
	});
	
	htmlbody = "<h1>New Items Added to Deep Media Plex!<h1><br />".concat(movieSection, showSection, episodeSection);
	logger.info(recipients)
	var mailOptions = {
		from: auth.email,
		to: recipients,
		subject: 'Deep Media Plex - New Items',
		html: htmlbody
	};
	return callback(mailOptions);
}