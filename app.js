const express = require("express");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "twitterClone.db");
let db = null;
const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server started and running...");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};
initializeDbAndServer();

const authenticateUser = (req, res, next) => {
  let jwtToken;
  const authHeader = req.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    res.status(401);
    res.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "SECRET", (err, payload) => {
      if (err) {
        res.status(401);
        res.send("Invalid JWT Token");
      } else {
        req.username = payload.username;
        next();
      }
    });
  }
};

//API To Register User
app.post("/register/", async (req, res) => {
  const { username, password, name, gender } = req.body;
  const getUserQuery = `SELECT * FROM user WHERE username="${username}";`;
  const dbUser = await db.get(getUserQuery);
  if (dbUser !== undefined) {
    res.status(400);
    res.send("User already exists");
  } else {
    if (password.length < 6) {
      res.status(400);
      res.send("Password is too short");
    } else {
      const hashedPassword = await bcrypt.hash(password, 10);
      const registerUserQuery = `INSERT INTO user (username,password,name,gender) 
            VALUES ("${username}","${hashedPassword}","${name}","${gender}");`;
      await db.run(registerUserQuery);
      res.send("User created successfully");
    }
  }
});

//API for User LOGIN
app.post("/login/", async (req, res) => {
  const { username, password } = req.body;
  const getUserQuery = `SELECT * FROM user WHERE username="${username}";`;
  const dbUser = await db.get(getUserQuery);
  //   console.log(username, dbUser);
  if (dbUser === undefined) {
    res.status(400);
    res.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === false) {
      res.status(400);
      res.send("Invalid password");
    } else {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "SECRET");
      res.send({ jwtToken: jwtToken });
    }
  }
});

//API to GET Latest Tweets
app.get("/user/tweets/feed/", authenticateUser, async (req, res) => {
  try {
    const { username } = req;
    const getUserQuery = `SELECT * FROM user WHERE username="${username}";`;
    const dbUser = await db.get(getUserQuery);
    // console.log(req, username, dbUser);
    const getTweetsQuery = `SELECT user.username,ft.tweet,ft.date_time as dateTime 
    FROM (follower INNER JOIN tweet ON follower.following_user_id=tweet.user_id) 
    as ft INNER JOIN user ON ft.user_id=user.user_id 
    WHERE ft.follower_user_id=${dbUser.user_id} 
    order by ft.date_time DESC 
    LIMIT 4;`;
    const tweetsArray = await db.all(getTweetsQuery);
    res.send(tweetsArray);
  } catch (e) {
    console.log(e.message);
  }
});

//API to GET the Usernames getting followed by User
app.get("/user/following/", authenticateUser, async (req, res) => {
  try {
    const { username } = req;
    const getUserQuery = `SELECT * FROM user WHERE username="${username}";`;
    const dbUser = await db.get(getUserQuery);
    const getFollowingQuery = `SELECT user.name FROM user INNER JOIN follower ON 
    user.user_id=follower.following_user_id 
    WHERE follower.follower_user_id=${dbUser.user_id};`;
    const followingArray = await db.all(getFollowingQuery);
    res.send(followingArray);
  } catch (e) {
    console.log(e.message);
  }
});

//API to GET the Usernames getting followed by User
app.get("/user/followers/", authenticateUser, async (req, res) => {
  try {
    const { username } = req;
    const getUserQuery = `SELECT * FROM user WHERE username="${username}";`;
    const dbUser = await db.get(getUserQuery);
    const getFollowingQuery = `SELECT user.name FROM user INNER JOIN follower ON 
    user.user_id=follower.follower_user_id 
    WHERE follower.following_user_id=${dbUser.user_id};`;
    const followingArray = await db.all(getFollowingQuery);
    res.send(followingArray);
  } catch (e) {
    console.log(e.message);
  }
});

//API To GET Tweet
app.get("/tweets/:tweetId/", authenticateUser, async (req, res) => {
  try {
    const { tweetId } = req.params;
    const { username } = req;
    const getUserQuery = `SELECT * FROM user WHERE username="${username}";`;
    const dbUser = await db.get(getUserQuery);

    const gettweeterId = `SELECT user_id FROM tweet WHERE tweet_id=${tweetId};`;
    const tweeterId = await db.get(gettweeterId);

    const getFollowingIdsQuery = `SELECT user.user_id FROM user INNER JOIN follower ON 
    user.user_id=follower.following_user_id 
    WHERE follower.follower_user_id=${dbUser.user_id};`;

    const followingIdsArray = await db.all(getFollowingIdsQuery);

    for (let eachId of followingIdsArray) {
      //   console.log(eachId, tweeterId, eachId.user_id === tweeterId.user_id);
      if (eachId.user_id === tweeterId.user_id) {
        const getTweetDetailsQuery = `SELECT tr.tweet as tweet,COUNT(like.like_id) as likes,
            COUNT(distinct tr.reply_id) as replies,tr.date_time as dateTime FROM 
            (tweet INNER JOIN reply ON tweet.tweet_id=reply.tweet_id) as tr 
            INNER JOIN like ON like.tweet_id=tweet.tweet_id 
            WHERE tr.tweet_id=${tweetId}`;
        const tweetDetails = await db.get(getTweetDetailsQuery);
        res.send(tweetDetails);
        return;
      }
    }
    res.status(401);
    res.send("Invalid Request");
  } catch (e) {
    console.log(e.message);
  }
});

//API To GET Likes of Tweet
app.get("/tweets/:tweetId/likes/", authenticateUser, async (req, res) => {
  try {
    const { tweetId } = req.params;
    const { username } = req;
    const getUserQuery = `SELECT * FROM user WHERE username="${username}";`;
    const dbUser = await db.get(getUserQuery);

    const gettweeterId = `SELECT user_id FROM tweet WHERE tweet_id=${tweetId};`;
    const tweeterId = await db.get(gettweeterId);

    const getFollowingIdsQuery = `SELECT user.user_id FROM user INNER JOIN follower ON 
    user.user_id=follower.following_user_id 
    WHERE follower.follower_user_id=${dbUser.user_id};`;

    const followingIdsArray = await db.all(getFollowingIdsQuery);

    for (let eachId of followingIdsArray) {
      //   console.log(eachId, tweeterId, eachId.user_id === tweeterId.user_id);
      if (eachId.user_id === tweeterId.user_id) {
        const getLikersQuery = `SELECT distinct tu.username as username FROM 
            (tweet INNER JOIN user ON tweet.user_id=user.user_id) as tu 
            INNER JOIN like ON like.tweet_id=tweet.tweet_id 
            WHERE tu.tweet_id=${tweetId}`;
        const likersArray = await db.all(getLikersQuery);
        res.send({
          likes: likersArray.map((e) => {
            return e.username;
          }),
        });
        return;
      }
    }
    res.status(401);
    res.send("Invalid Request");
  } catch (e) {
    console.log(e.message);
  }
});

//API To GET Replies of Tweet
app.get("/tweets/:tweetId/replies/", authenticateUser, async (req, res) => {
  try {
    const { tweetId } = req.params;
    const { username } = req;
    const getUserQuery = `SELECT * FROM user WHERE username="${username}";`;
    const dbUser = await db.get(getUserQuery);

    const gettweeterId = `SELECT user_id FROM tweet WHERE tweet_id=${tweetId};`;
    const tweeterId = await db.get(gettweeterId);

    const getFollowingIdsQuery = `SELECT user.user_id FROM user INNER JOIN follower ON 
    user.user_id=follower.following_user_id 
    WHERE follower.follower_user_id=${dbUser.user_id};`;

    const followingIdsArray = await db.all(getFollowingIdsQuery);

    for (let eachId of followingIdsArray) {
      //   console.log(eachId, tweeterId, eachId.user_id === tweeterId.user_id);
      if (eachId.user_id === tweeterId.user_id) {
        const getRepliesQuery = `SELECT distinct tu.name as name,reply.reply as reply FROM 
            (tweet INNER JOIN user ON tweet.user_id=user.user_id) as tu 
            INNER JOIN reply ON reply.tweet_id=tweet.tweet_id 
            WHERE tu.tweet_id=${tweetId}`;
        const repliesArray = await db.all(getRepliesQuery);
        res.send({
          replies: repliesArray,
        });
        return;
      }
    }
    res.status(401);
    res.send("Invalid Request");
  } catch (e) {
    console.log(e.message);
  }
});

//API to GET Tweets of User
app.get("/user/tweets/", authenticateUser, async (req, res) => {
  try {
    const { username } = req;
    const getUserQuery = `SELECT * FROM user WHERE username="${username}";`;
    const dbUser = await db.get(getUserQuery);

    const getTweetDetailsQuery = `SELECT tr.tweet as tweet,COUNT(like.like_id) as likes,
            COUNT(distinct tr.reply_id) as replies,tr.date_time as dateTime FROM 
            (tweet INNER JOIN reply ON tweet.tweet_id=reply.tweet_id) as tr 
            INNER JOIN like ON like.tweet_id=tweet.tweet_id 
            WHERE tr.user_id=${dbUser.user_id}`;
    const tweetDetails = await db.all(getTweetDetailsQuery);
    res.send(tweetDetails);
  } catch (e) {
    console.log(e.message);
  }
});

//API to POST tweet
app.post("/user/tweets/", authenticateUser, async (req, res) => {
  try {
    const { username } = req;
    const { tweet } = req.body;
    const getUserQuery = `SELECT * FROM user WHERE username="${username}";`;
    const dbUser = await db.get(getUserQuery);
    let date = new Date(Date.now());
    // console.log(
    //   date.toISOString().slice(0, 10) + " " + date.toISOString().slice(11, 19)
    // );
    const tweetDate =
      date.toISOString().slice(0, 10) + " " + date.toISOString().slice(11, 19);
    const createTweetQuery = `INSERT INTO tweet (tweet,user_id,date_time) 
    VALUES("${tweet}",${dbUser.user_id},"${tweetDate}");`;
    await db.run(createTweetQuery);
    res.send("Created a Tweet");
  } catch (e) {
    console.log(e.message);
  }
});

//API to DELETE Tweet
app.delete("/tweets/:tweetId/", authenticateUser, async (req, res) => {
  const { tweetId } = req.params;
  const { username } = req;
  const getUserQuery = `SELECT * FROM user WHERE username="${username}";`;
  const dbUser = await db.get(getUserQuery);
  const getTweetQuery = `SELECT * FROM tweet WHERE tweet_id=${tweetId};`;
  const dbTweet = await db.get(getTweetQuery);
  if (dbUser.user_id !== dbTweet.user_id) {
    res.status(401);
    res.send("Invalid Request");
    return;
  } else {
    const deleteTweetQuery = `DELETE FROM tweet WHERE tweet_id=${tweetId};`;
    await db.run(deleteTweetQuery);
    res.send("Tweet Removed");
  }
});
module.exports = app;
