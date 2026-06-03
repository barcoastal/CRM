@IsTest
private class ProfileDataTest {
    
    @IsTest
    static void testQueryProfile(){

        Id profileId = [SELECT Id FROM Profile WHERE Name = 'System Administrator'].Id;
        
        Test.startTest();
        List<Profile> profiles = ProfileData.queryProfile(profileId);
        Test.stopTest();
        
        System.assert(!profiles.isEmpty());
        System.assertEquals('System Administrator', profiles[0].Name);
    }
}