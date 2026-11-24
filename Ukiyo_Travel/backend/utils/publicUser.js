/**
 * Shape a User document for API responses.
 * Never includes the password hash. Used by both auth and user controllers.
 */
function publicUser(user) {
  return {
    id: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone || "",
    country: user.country || "",
    city: user.city || "",
    bio: user.bio || "",
    avatarUrl: user.avatarUrl || "",
    wishlist: user.wishlist || [],
    role: user.role || "user",
    isActive: user.isActive !== false,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

module.exports = publicUser;
