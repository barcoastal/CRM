export const useSession = () => ({
  data: {
    user: {
      id: "me",
      name: "Alex Morgan",
      email: "preview@example.test",
      role: "ADMIN",
      permissions: ["Modify.AllData"],
    },
  },
  status: "authenticated",
});
export const signOut = async () => {};
