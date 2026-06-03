@isTest
public class DispositionControllerTest {
    @isTest
    static void getRTDetailsOfLeadRecord() { 
        ApexActionResult result;
        Lead leadRec = DataFactoryTest.createListLead();
        insert leadRec;
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());
        result = DispositionController.getRTDetailsOfRecord(leadRec.Id);
        Test.stopTest();
        String recordDetailsString = String.valueOf(result.data);
        DispositionController.RecordDetails paymentCalcElementWrapper = (DispositionController.RecordDetails)JSON.deserialize(recordDetailsString, DispositionController.RecordDetails.class);
        System.assertEquals('Lead',  paymentCalcElementWrapper.objectName);
    }

    @isTest
    static void getRTDetailsOfOpportunityRecord() {
        ApexActionResult result;
        Opportunity oppRec = DataFactoryTest.createOpportunity();
        insert oppRec;
        Test.startTest();
        result = DispositionController.getRTDetailsOfRecord(oppRec.Id);
        Test.stopTest();
        String recordDetailsString = String.valueOf(result.data);
        DispositionController.RecordDetails paymentCalcElementWrapper = (DispositionController.RecordDetails)JSON.deserialize(recordDetailsString, DispositionController.RecordDetails.class);
        System.assertEquals('Opportunity', paymentCalcElementWrapper.objectName);
    }
    
    @isTest
    static void getRTDetailsOfAccountRecord() {
        ApexActionResult result;
        Account acctRecord = DataFactoryTest.createBusinessAccount();
        insert acctRecord;
        Test.startTest();
        result = DispositionController.getRTDetailsOfRecord(acctRecord.Id);
        Test.stopTest();
        String recordDetailsString = String.valueOf(result.data);
        DispositionController.RecordDetails paymentCalcElementWrapper = (DispositionController.RecordDetails)JSON.deserialize(recordDetailsString, DispositionController.RecordDetails.class);
        System.assertEquals('Account', paymentCalcElementWrapper.objectName);
    }

    @isTest
    static void saveDispositionDetailsTask() {
        Task taskRec = DataFactoryTest.createTask();
        Map<String, Object> dataMap = new Map<String, Object> {
            'dispositionRecord' => taskRec
        };
        Test.startTest();
        DispositionController.saveDispositionDetails(JSON.serialize(dataMap));
        Test.stopTest();
        //List<Task> taskRecQueried = [SELECT Id FROM Task];
        //System.assertEquals(1, taskRecQueried.size());
    }

    @isTest
    static void saveDispositionDetailsEvent() {
        Event eventRec = DataFactoryTest.createEvent();
        Map<String, Object> dataMap = new Map<String, Object> {
            'dispositionEventRecord' => eventRec
        };
        Test.startTest();
        DispositionController.saveDispositionDetails(JSON.serialize(dataMap));
        Test.stopTest();
        List<Event> eventRecQueried = [SELECT Id FROM Event];
        System.assertEquals(1, eventRecQueried.size());
    }

    @isTest
    static void saveDispositionDetailsLead() {
        Lead leadRec = DataFactoryTest.createListLead();
        leadRec.Status = 'Working Lead';
        leadRec.Sub_Disposition__c = 'Call Transferred from Fronter';
        insert leadRec;
        Map<String, Object> dataMap = new Map<String, Object> {
            'leadRecord' => leadRec
        };
        Test.startTest();
        DispositionController.saveDispositionDetails(JSON.serialize(dataMap));
        Test.stopTest();
        List<Lead> leadRecQueried = [SELECT Id FROM Lead];
        System.assertEquals(1, leadRecQueried.size());
    }
    
    @isTest
    static void saveDispositionDetailsAccount() {
        Account acctRecord = DataFactoryTest.createBusinessAccount();
        acctRecord.client_Status__c = 'Active';
        insert acctRecord;
        acctRecord.client_Status__c = 'Cancelled';
        acctRecord.Cancellation_Reason__c = 'Non Payments';
        update acctRecord;
        
        Map<String, Object> dataMap = new Map<String, Object> {
            'accountRecord' => acctRecord 
        };
        Test.startTest();
        DispositionController.saveDispositionDetails(JSON.serialize(dataMap));
        Test.stopTest();
        List<Account> acctRecQueried = [SELECT Id FROM Account];
        System.assertEquals(1, acctRecQueried.size());
    }

    @isTest
    static void saveDispositionDetailsOpportunity() {
        Account acctRecord = DataFactoryTest.createBusinessAccount();
        acctRecord.client_Status__c = 'Active';
        insert acctRecord;
        
        Opportunity oppRec = DataFactoryTest.createOpportunity('test','Working Opportunity', acctRecord.Id);
        oppRec.Sub_Disposition__c = 'Left VM';
        insert oppRec;
        acctRecord.client_Status__c = 'Cancelled';
        acctRecord.Cancellation_Reason__c = 'Non Payments';
        update acctRecord;
        
        oppRec.StageName = 'Archived';
        oppRec.Sub_Disposition__c = 'High UCC Risk';
        Map<String, Object> dataMap = new Map<String, Object> {
            'oppportunityRecord' => oppRec
        };
        Test.startTest();
        DispositionController.saveDispositionDetails(JSON.serialize(dataMap));
        Test.stopTest();
        List<Opportunity> oppRecQueried = [SELECT Id FROM Opportunity];
        System.assertEquals(1, oppRecQueried.size());
    }
    @isTest
    static void saveDispositionNoteTask() {
        Task taskRec = DataFactoryTest.createTask();
        Map<String, Object> dataMap = new Map<String, Object> {
            'noteRecord' => taskRec
        };
        Test.startTest();
        DispositionController.saveDispositionDetails(JSON.serialize(dataMap));
        DispositionController.createReminderTask(taskRec);
        Test.stopTest();
        List<Task> taskRecQueried = [SELECT Id FROM Task];
        System.assertEquals(1, taskRecQueried.size());
    }
    
    @isTest
    static void saveDispositionsetCustomerStatus1() {
        ApexActionResult result;
        Account acctRecord = DataFactoryTest.createBusinessAccount();
        acctRecord.client_Status__c = 'Active';
        insert acctRecord;
        try{
        Test.startTest();
        result = DispositionController.setCustomerStatus(acctRecord.Id, 'First Payment Pending');
        Test.stopTest();
        }catch(Exception ex){
            System.assertEquals('Client Status update not allowed. The selected transition is invalid.', ex.getMessage());
        }
    }
    
     @isTest
    static void saveDispositionsetCustomerStatus() {
        ApexActionResult result;
        Account acctRecord = DataFactoryTest.createBusinessAccount();
        acctRecord.client_Status__c = 'Active';
        acctRecord.External_SAS_Id__c = '1111';
        insert acctRecord;
        Test.startTest();
        result = DispositionController.setCustomerStatus(acctRecord.Id, 'On Hold');
        Test.stopTest();
    }
    
}