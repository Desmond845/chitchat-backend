const generateUniqueShortId = async () => {
  let shortId;
  let exists = true;
  while (exists) {
    shortId = Math.floor(1000000 + Math.random() * 9000000).toString(); // 7‑digit string
    exists = await User.findOne({ shortId });
  }
  return shortId;
};