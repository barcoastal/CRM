public inherited sharing class SMSTemplateData {

    /**
     * @description: method to query the SMS template custom metadata records
     * @param1: String objectName - to filter the SMS templates based on the object
     * @returnType: List<SMS_Template__mdt>
    */
    public static List<SMS_Template__mdt> queryRecords(String objectName) {
        List<SMS_Template__mdt> smsTemplateList = [SELECT Id, Label, DeveloperName, Object__c, SMS_Body__c 
            FROM SMS_Template__mdt WHERE Object__c = :objectName];
        //If it is test class context, replace the SMS template list with the test data
        if (Test.isRunningTest()) {
            smsTemplateList = new List<SMS_Template__mdt> {DataFactoryTest.createSMSTemplate()};
        } 
        return smsTemplateList;
    }
}