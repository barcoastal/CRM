@IsTest
private class SASSettingsTest {
    
    @IsTest
    static void testGetSource(){
        
        SAS_Settings__c settings = new SAS_Settings__c();
        settings.Endpoint__c = 'https://test.com';
        insert settings;

        SASSettings sasSettings = new SASSettings();
        System.assertEquals('https://test.com', sasSettings.endpoint);
    }
}