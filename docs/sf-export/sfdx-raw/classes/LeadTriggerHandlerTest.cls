@isTest
public class LeadTriggerHandlerTest {

    @isTest
    public static void handleAfterinsertTest(){
               
        List<Lead> leadsToInsert = new List<Lead>{
            new Lead(FirstName='John', LastName='Doe', Company='Acme Inc.', Phone='9876543201'),
            new Lead(FirstName='Jane', LastName='Doe', Company='Acme Inc.', Phone='9876543202')
        };

        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());
        insert leadsToInsert;
        Test.stopTest();  
         
        List<Lead> insertedLeads = [
            SELECT Id, FirstName, LastName, Company FROM Lead 
            WHERE FirstName IN ('John', 'Jane') AND LastName = 'Doe' AND Company = 'Acme Inc.'
        ];
        Assert.areEqual(2, insertedLeads.size(), 'The expected number of leads was not inserted.'); 
    }

    @isTest    
    public static void handleafterUpdateTest(){
        
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());

        List<Lead> leadsToInsert = new List<Lead>{
            new Lead(FirstName='John', LastName='Doe', Company='Acme Inc.', Phone='9876543201'),
            new Lead(FirstName='Jane', LastName='Doe', Company='Acme Inc.', Phone='9876543202', Status = 'New')
        };
        insert leadsToInsert;

        List<Lead> insertedLeads = [
            SELECT Id, FirstName, LastName, Company, Status FROM Lead WHERE FirstName IN ('John', 'Jane') AND LastName = 'Doe' 
            AND Company = 'Acme Inc.' ORDER BY Status NULLS FIRST
        ];
        Assert.areEqual(2, insertedLeads.size(), 'The expected number of leads was not inserted.');
        
        //Update data
        Lead leadToUpdate = insertedLeads[0];
        leadToUpdate.Company = 'New Acme Inc.';
        Lead stausUpdate = insertedLeads[1];
        stausUpdate.Status = 'Archive Disposition';
        stausUpdate.Sub_Disposition__c = 'Bad State';
        List<Lead> leadsToUpdate = new List<Lead>{leadToUpdate, stausUpdate};

        Test.startTest();
        update leadsToUpdate;
        Test.stopTest();        
        
        Lead updatedLead = [SELECT Id, FirstName, LastName, Company FROM Lead WHERE Id = :leadToUpdate.Id];
        Assert.areEqual('New Acme Inc.', updatedLead.Company, 'The lead was not updated correctly.');
        Lead verifyLead = [SELECT Id, Last_Disposition__c FROM Lead WHERE Id = :stausUpdate.Id];
        Assert.areEqual('New', verifyLead.Last_Disposition__c, 'The last disposition was not updated correctly.');
    }   

    @IsTest
    static void createTaskOnStatusChangeTest(){

        Lead leadInstance = DataFactoryTest.createListLead();
        
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());
        insert leadInstance;
        leadInstance.Status = 'Working Lead';
        update leadInstance;
        Test.stopTest();
        
        Task taskInstance = [SELECT Id, WhoId, Description, Status, Subject FROM Task LIMIT 1];
        Assert.areEqual(leadInstance.Id, taskInstance.WhoId);
        Assert.areEqual('Completed', taskInstance.Status);
        Assert.areEqual('Lead Status changed from New to Working Lead', taskInstance.Description);
        Assert.areEqual('Status Changed to Working Lead', taskInstance.Subject);
    }

    @IsTest
    static void calculateCurrentTotalWeeklyPaymentTest(){

        Lead leadInstance = DataFactoryTest.createListLead();
        leadInstance.Creditor_1_Name__c = 'Wells Fargo';
        leadInstance.Creditor_1_Total_Debt__c = 50000;
        leadInstance.Creditor_1_Payment__c = 700;
        leadInstance.Creditor_1_Payment_Frequency__c = 'Weekly';
        leadInstance.Creditor_2_Name__c = 'Bank of America Test';
        leadInstance.Creditor_2_Total_Debt__c = 30000;
        leadInstance.Creditor_2_Payment__c = 300;
        leadInstance.Creditor_2_Payment_Frequency__c = 'Daily';
        
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());
        insert leadInstance;
        leadInstance.Creditor_1_Payment__c = 500;
        leadInstance.Creditor_1_Payment_Frequency__c = 'Daily';
        leadInstance.Creditor_2_Payment_Frequency__c = 'Monthly';
        update leadInstance;
        Test.stopTest();
        
        Lead verifyLead = [
            SELECT Id, Current_Total_Weekly_Payment__c, Current_Total_Debt_Amount__c, 
            Current_Total_Daily_Payment__c, Current_Total_Monthly_Payment_Formula__c 
            FROM Lead LIMIT 1
        ];
        Assert.areEqual(2575, verifyLead.Current_Total_Weekly_Payment__c);
        Assert.areEqual(80000, verifyLead.Current_Total_Debt_Amount__c);
        Assert.areEqual(515, verifyLead.Current_Total_Daily_Payment__c);
        Assert.areEqual(10300, verifyLead.Current_Total_Monthly_Payment_Formula__c);
    }

  /*@IsTest
    static void shareLeadTOMCATest(){
        
        Lead leadRec = DataFactoryTest.createBusinessLead();
        leadRec.Email = 'test@gmail.com';
        leadRec.Street = 'Test Street';
        leadRec.City = 'Test City';
        leadRec.State = 'Florida';
        leadRec.PostalCode ='9987654';
        leadRec.Status = 'Transfer';
        insert leadRec;  
        
        insert new MCA_Lender_Settings__c(Endpoint__c = 'https://test.com'); 
           
        leadRec.five9_Disposition__c = 'Looking for a loan';
        update leadRec;
        
        List<Id> leadIds = new List<Id>{leadRec.Id};
        
        Test.startTest();        
        System.enqueueJob(new MCALenderAPICallout(leadIds));
        Test.stopTest();  
    }*/
    
    @isTest
    static void subDispoRequiredForArchivedLeadsTest(){
        
        Test.startTest();        
        Lead leadRec = DataFactoryTest.createListLead();
        leadRec.status = 'Archive Disposition';
        leadRec.Sub_Disposition__c = '';
        insert leadRec;
        Test.stopTest();
 
        List<Application_log__c> applicationLog = [SELECT Id, Record_Id__c FROM Application_log__c WHERE Record_Id__c = :leadRec.Id LIMIT 1];
        
        Assert.areNotEqual(applicationLog.isEmpty(),True);
    }
}