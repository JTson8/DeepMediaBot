const config = require('./savedData/config.json');
const radarrConfig = require('./savedData/radarrConfig.json');
const medusaConfig = require('./savedData/medusaConfig.json');
const http = require('http');
const logger = require('winston');

function searchTMDBShow(term, callback) {
	http.get(encodeURI(`http://api.themoviedb.org/3/search/tv?api_key=${medusaConfig.tmdbapikey}&query=${term}`), (resp) => {
		let data = "";
		
		resp.on('data', (chunk) => {
			data += chunk;
		});
		
		resp.on('end', () => {
			return callback(JSON.parse(data).results);
		});
	}).on("error", (err) => {
		logger.error(err.message);
	});
}

function addMedusaShow(id, callback) {
	var options = {
		protocol: 'http:',
        host: medusaConfig.host,
        port: medusaConfig.port,
        path: `/api/v2/series`,
        method: 'POST',
        headers: {
            'X-Api-Key': medusaConfig.apikey,
			'Content-Type': 'application/json'
        }
    }
	
	var request = http.request(options, (resp) => {
		let data = "";
		
		resp.on('data', (chunk) => {
			data += chunk;
		});
		
		resp.on('end', () => {
			return callback(JSON.parse(data));
		});
	}).on("error", (err) => {
		logger.error(err);
	});
	request.write(`{"id": {"tmdb": ${id}}}`);
	request.end();
}

function searchRadarrMovie(term, callback) {
	doRadarrGetAPICall(`movie/lookup?term='${term}'`, function(jsonResult) {
		var movies = new Set();
		jsonResult.forEach(function(movie) {movies.add(movie);});
		return callback(movies);
	});
}

function getRadarrMovieFiles(id, callback) {
	doRadarrGetAPICall(`release?movieId=${id}`, function(jsonResult) {
		var movies = new Set();
		jsonResult.forEach(function(movie) {movies.add(movie);});
		return callback(movies);
	});
}

function addRadarrMovie(movie, callback) {
	movie.qualityProfileId = 1;
	movie.monitored = false;
	movie.rootFolderPath = "/mnt/movies";
	doRadarrPostAPICall(`movie`, movie, function(jsonResult) {
		return callback(jsonResult);
	});
}

function downloadRadarrMovie(guidObject, callback) {
	doRadarrPostAPICall(`release`, guidObject, function(jsonResult) {
		return callback(jsonResult);
	});
}

function doRadarrGetAPICall(command, callback) {
	var options = {
		protocol: 'http:',
        host: radarrConfig.host,
        port: radarrConfig.port,
        path: encodeURI(`/api/v3/${command}`),
        method: 'GET',
        headers: {
            'X-Api-Key': radarrConfig.apikey
        }
    }
	
	var request = http.request(options, (resp) => {
		let data = "";
		
		resp.on('data', (chunk) => {
			data += chunk;
		});
		
		resp.on('end', () => {
			try {
				return callback(JSON.parse(data));
			} catch (e) {
				return callback([]);
			}
		});
	}).on("error", (err) => {
		logger.error(err.message);
	});
	request.end();
}

function doRadarrPostAPICall(command, content, callback) {
	logger.info(`/api/v3/${command}`);
	var options = {
		protocol: 'http:',
        host: radarrConfig.host,
        port: radarrConfig.port,
        path: `/api/v3/${command}`,
        method: 'POST',
        headers: {
            'X-Api-Key': radarrConfig.apikey,
			'Content-Type': 'application/json'
        }
    }
	
	var request = http.request(options, (resp) => {
		let data = "";
		
		resp.on('data', (chunk) => {
			data += chunk;
		});
		
		resp.on('end', () => {
			return callback(JSON.parse(data));
		});
	}).on("error", (err) => {
		return callback(false);
		logger.error(err.message);
	});
	
	request.write(JSON.stringify(content));
	request.end();
}

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
		if (userId === "") return callback(new Map());
		var userStatsMap = new Map();
		doAPICall(`get_user_watch_time_stats&user_id=${userId}`, function(jsonResult) {
			jsonResult.response.data.forEach(function(data) {
				if(data.query_days === 1) userStatsMap.set('dailyWatch', data);
				else if(data.query_days === 7) userStatsMap.set('weeklyWatch', data);
				else if(data.query_days === 30) userStatsMap.set('monthlylWatch', data);
				else if(data.query_days === 0) userStatsMap.set('allTimeWatch', data);
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
			if (user.friendly_name === username) { userId = user.user_id; }
		});
		return callback(userId);
	});
}

module.exports = {getRecentlyAddedMovies, getRecentlyAddedShows, home_stats, user_stats, getUsers, searchRadarrMovie, addRadarrMovie, getRadarrMovieFiles, downloadRadarrMovie, searchTMDBShow, addMedusaShow}
