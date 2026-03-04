import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
async function hash () {
  const password =  await bcrypt.hash("dessypoo", 10);
  console.log(password);
}
//  hash();
//  return;
const userSchema = new mongoose.Schema({
id: { type: Number, required: true, unique: true },
  username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },

  password: { type: String, required: true },
  lastSeen: { type: Date},
    // password: { type: String, required: true },
avatar: {type: String, default: ''},
bio: {type: String, default: ''}
  // You can add more fields later: displayName, avatar, etc.
}, { timestamps: true });

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  // next();
// console.log(next);
});

// Method to check password
userSchema.methods.comparePassword = async function(candidate) {
  return await bcrypt.compare(candidate, this.password);
};
// $2b$10$c5DmYo1iljp5fhqk6ixOeuh5OnT3bWhVGqB7HQvWzt7yXwg6VGG9W
//  $2b$10$c5DmYo1iljp5fhqk6ixOeuh5OnT3bWhVGqB7HQvWzt7yXwg6VGG9W
// In seed script or manually add:
// {
//   id: 0000001, // special ID
//   username: 'ChitChat Official',
//   email: 'official@chitchat.com',
//   password: bcrypt.hashSync('some-secure-password', 10),
//   bio: 'Official announcements and updates',
//   avatar: '/official-avatar.png'
// }
const User = mongoose.model('User', userSchema);
export default User;