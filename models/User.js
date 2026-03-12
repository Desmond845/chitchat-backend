import mongoose from "mongoose";
import bcrypt from "bcrypt";

const userSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true },
    username: {
      type: String,
      required: true,
      unique: true,
      set: (v) => v.toLowerCase(),
    },
    email: { type: String, required: true, unique: true },

    password: { type: String, required: true },
    lastSeen: { type: Date },

    avatar: { type: String, default: "" },
    bio: { type: String, default: "" },
    pushSubscription: { type: Object, default: null },
  },
  { timestamps: true }
);

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
});

// Method to check password
userSchema.methods.comparePassword = async function (candidate) {
  return await bcrypt.compare(candidate, this.password);
};

const User = mongoose.model("User", userSchema);
export default User;
