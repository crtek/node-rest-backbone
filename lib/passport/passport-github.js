/**
 * passport-github.js
 *
 * Passport setup for Github OAUTH authentication.
 */

var GitHubStrategy = require('passport-github').Strategy;

module.exports = function(config, app, db_conn, passport) {
	var User = db_conn.model('User');

	// Use the GitHubStrategy within Passport.
	//   Strategies in Passport require a `verify` function, which accept
	//   credentials (in this case, an accessToken, refreshToken, and GitHub
	//   profile), and invoke a callback with a user object.
	passport.use(new GitHubStrategy({
			clientID: config.github.id,
			clientSecret: config.github.secret,
			callbackURL: "http://" + config.node.hostname + ":" + config.node.port + "/auth/github/callback"
		},
		function(accessToken, refreshToken, profile, done) {
			console.log("Passport.authenticate(): accessToken=" + accessToken + " profile.emails[0]=" + profile.emails[0].value + " profile.id=" + profile.id);

			process.nextTick(function () {
				User.findOne({ 'accounts.uid': profile.id, 'accounts.provider': 'github' }, function(err, olduser) {
					console.log("User.findOne(): callback profile.emails[0]=" + profile.emails[0].value + " profile.id=" + profile.id);
					if(olduser) {
						// We have an existing user record matching the same provider ID, so just return it
						done(null, olduser);
					} else {
						// This user has not logged in with this provider before
						User.findOne({ 'email': profile.emails[0].value }, function(err, olduser) {
							var account;

							if (olduser) {
								// We have an existing user record with the same email address that hasn't logged in with this provider, yet.
								// Always over-write existing user properties with new user properties from the latest provider. Is this the
								// right thing to do?
								account = { provider: "github", uid: profile.id };
								olduser.accounts.push(account);
								olduser.displayName = profile.displayName;
								// Github doesn't sent first/last name properties
								// olduser.name.first = profile.name.givenName;
								// olduser.name.last = profile.name.familyName;
								olduser.save(function(err) {
									if(err) { throw err; }
									done(null, olduser);
								});							
							} else {
								// We need to create a new user record
								var newuser = new User();
								account = { provider: "github", uid: profile.id };
								newuser.accounts.push(account);
								newuser.displayName = profile.displayName;
								// Github doesn't sent first/last name properties
								// newuser.name.first = profile.name.givenName;
								// newuser.name.last = profile.name.familyName;
								newuser.email = profile.emails[0].value;

								newuser.save(function(err) {
									if(err) { throw err; }
									done(null, newuser);
								});
							}
						});
					}
				});
			});
		}
	));

	// GET /auth/github
	//   Use passport.authenticate() as route middleware to authenticate the
	//   request.  The first step in GitHub authentication will involve redirectingß
	//   the user to github.com.  After authorization, GitHub will redirect the user
	//   back to this application at /auth/github/callback
	app.get('/auth/github',
		passport.authenticate('github'),
		function(req, res){
			// The request will be redirected to GitHub for authentication, so this
			// function will not be called.
		});

	// GET /auth/github/callback
	//   Use passport.authenticate() as route middleware to authenticate the
	//   request.  If authentication fails, the user will be redirected back to the
	//   login page.  Otherwise, the primary route function will be called,
	//   which, in this example, will redirect the user to the home page.
	app.get('/auth/github/callback', 
		passport.authenticate('github', { failureRedirect: '/signin' }),
		function(req, res) {
			res.redirect('/app');
		});

	return passport;
};
