@IsTest
private class RAMSettingsTest {

    @IsTest
    static void testConstructorWithSettings() {
        // Create RAMS_Settings__c custom settings
        RAMS_Settings__c settings = new RAMS_Settings__c(
            Name = 'RAM Settings',
            Endpoint__c = 'https://example.com/api',
            APIKey__c = 'testApiKey',
            Affiliate_ID__c = '1234',
            Fee_Split_Group_ID__c = '1234'
        );
        insert settings;

        Test.startTest();
        // Create instance of RAMSettings class
        RAMSettings ramSettings = new RAMSettings();
        Test.stopTest();
        // Verify that the  apiKey properties are set correctly
        Assert.areEqual('testApiKey', ramSettings.apiKey, 'Expected APIKey is not matching.');
    }
}