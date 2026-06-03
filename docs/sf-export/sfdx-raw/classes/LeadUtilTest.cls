@IsTest
private class LeadUtilTest {

    @IsTest
    static void testGetRTDetailsOfRecord() {
        // Create a test Lead record
        Lead testLead = new Lead();
        testLead.LastName = 'Doe';
        testLead.Phone = '9087654321';
        testLead.RecordTypeId = ApexUtil.getRecordTypeIdbyDeveloperName('Lead', 'Web_Lead');
        testLead.leadSource = 'Web';
        LeadTriggerHandler.preventRecursion = true;
        insert testLead;
        
        // Call the getRTDetailsOfRecord() method
        Lead resultLead = LeadUtil.getRTDetailsOfRecord(testLead.Id);
        
        // Verify the result
        System.assertEquals(testLead.Id, resultLead.Id);
        System.assertEquals('Web_Lead', resultLead.RecordType.DeveloperName);
    }
    
    @IsTest
    static void testGetRTDetailsOfRecordVoid() {
        // Call the getRTDetailsOfRecord() method
        Lead resultLead = LeadUtil.getRTDetailsOfRecord(null);        
        // Verify the result
        System.assertEquals(null, resultLead);
    }
    
    @IsTest
    static void testGetSObjName() {
        String sObjName = new LeadUtil().getSObjName();
        // Verify that the method returns null
        System.assertEquals('Lead', sObjName);
    }
    
    @IsTest
    static void testGetSObjLabel() {
        String sObjLabel = new LeadUtil().getSObjLabel();
        // Verify that the method returns null
        System.assertEquals('Lead', sObjLabel);
    }   
    
    @IsTest
    static void testIsLeadId_Valid(){

        // Create a test Lead record
        Lead testLead = new Lead(LastName = 'Doe', Phone = '9087654321');
        LeadTriggerHandler.preventRecursion = true;
        insert testLead;

        System.assert(LeadUtil.isLeadId(testLead.Id));
    }
    
    @IsTest
    static void testIsLeadId_InValid(){
        Account acct = new Account(FirstName = 'Nyssa', LastName = 'Vazquez');
        insert acct;
        System.assert(!LeadUtil.isLeadId(acct.Id));
    }
    
    @IsTest
    static void testRecordTypeId(){
        LeadUtil.getLeadRTIds();
    }
    
    @IsTest
    static void testgetFieldsetDetails(){
        List<SObjectUtilHelper.FieldSetDetails> fieldsetDetailsList = new LeadUtil().getFieldsetDetails('Lead_Call_Transfered_TO');
        
        System.assertEquals(10, fieldsetDetailsList.size());
        System.assertEquals('FronterLookup__c', fieldsetDetailsList[0].fieldName);
        System.assertEquals('CloserLookup__c', fieldsetDetailsList[1].fieldName);
        System.assertEquals('Call_Transferred_By_Lookup__c', fieldsetDetailsList[2].fieldName);
        System.assertEquals('Call_Received_By_Lookup__c', fieldsetDetailsList[3].fieldName);    }
}