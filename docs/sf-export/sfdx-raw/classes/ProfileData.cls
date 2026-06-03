public inherited sharing class ProfileData {
    public static List<Profile> queryProfile(Id profileId) {
        return [SELECT Id, Name FROM Profile WHERE Id = :profileId];
    }
}