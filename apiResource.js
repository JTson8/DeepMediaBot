var config = require('./config.json');
var http = require('http');
var logger = require('winston');

function getRecentlyAddedMovies(callback) {
	doAPICall('get_recently_added&count=20&media_type=movie', function(jsonResult) {
		var movies = new Set();
		jsonResult.response.data.recently_added.forEach(function(movie) {movies.add(movie);});
		return callback(movies);
	});
}

function getRecentlyAddedShows(callback) {
	doAPICall('get_recently_added&count=20&media_type=show', function(jsonResult) {
		var shows = new Set();
		jsonResult.response.data.recently_added.forEach(function(show) {shows.add(show);});
		return callback(shows);
	});
}

function doAPICall(command, callback) {
	http.get(`${config.host}:${config.port}/api/v2?apikey=${config.apikey}&cmd=${command}`, (resp) => {
		let data = "";
		
		resp.on('data', (chunk) => {
			data += chunk;
		});
		
		resp.on('end', () => {
			return callback(JSON.parse(data));
		});
	}).on("error", (err) => {
		logger.error(err.message);
	});
}

function home_stats(days, callback) {
	var homeStatsMap = new Map();
	doAPICall(`get_home_stats&time_range=${days}`, function(jsonResult) {
		var topMovies = new Set();
		var popularMovies = new Set();
		var topShows = new Set();
		var popularShows = new Set();
		var topUsers = new Set();
		jsonResult.response.data.forEach(function(data) {
			switch (data.stat_id) {
				case 'top_movies':
					data.rows.forEach(function(topMovie) {topMovies.add(topMovie)});
					break;
				case 'popular_movies':
					data.rows.forEach(function(popMovie) {popularMovies.add(popMovie)});
					break;
				case 'top_tv':
					data.rows.forEach(function(topTV) {topShows.add(topTV)});
					break;
				case 'popular_tv':
					data.rows.forEach(function(popTV) {popularShows.add(popTV)});
					break;
				case 'top_users':
					data.rows.forEach(function(user) {topUsers.add(user)});
					break;
				break;
			}
		});
		homeStatsMap.set("topMovies", topMovies);
		homeStatsMap.set("popularMovies", popularMovies);
		homeStatsMap.set("topShows", topShows);
		homeStatsMap.set("popularShows", popularShows);
		homeStatsMap.set("topUsers", topUsers);
		return callback(homeStatsMap);
	});
}

function user_stats(username, callback) {
	get_user_id(username, function(userId) {
		if (userId == "") return callback(new Map());
		var userStatsMap = new Map();
		doAPICall(`get_user_watch_time_stats&user_id=${userId}`, function(jsonResult) {
			jsonResult.response.data.forEach(function(data) {
				if(data.query_days == 1) userStatsMap.set('dailyWatch', data);
				else if(data.query_days == 7) userStatsMap.set('weeklyWatch', data);
				else if(data.query_days == 30) userStatsMap.set('monthlylWatch', data);
				else if(data.query_days == 0) userStatsMap.set('allTimeWatch', data);
			});
			doAPICall(`get_user_ips&user_id=${userId}`, function(jsonResult) {
				var len = 3;
				var lastWatchedSet = new Set();
				if (jsonResult.response.data.data.length < 3) len = jsonResult.response.data.data.length;
				for(var i = 0; i < len; i++) {
					lastWatchedSet.add(jsonResult.response.data.data[i]);
				}
				userStatsMap.set('lastWatched', lastWatchedSet);
				return callback(userStatsMap);
			});
		});
	});
}

function getUsers(callback) {
	doAPICall('get_user_names', function(jsonResult) {
		var users = new Set();
		jsonResult.response.data.forEach(function(user) {
			users.add(user);
		});
		return callback(users);
	});
}

function get_user_id(username, callback) {
	doAPICall('get_user_names', function(jsonResult) {
		var userId = "";
		jsonResult.response.data.forEach(function(user) {
			if (user.friendly_name == username) { userId = user.user_id; }
		});
		return callback(userId);
	});
}

module.exports = {getRecentlyAddedMovies, getRecentlyAddedShows, home_stats, user_stats, getUsers}