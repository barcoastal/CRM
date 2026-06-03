/*----------------------------------------------------------------
    Author: Vignesh P
    Description: A test class to cover the actions of the AccountAfterTriggerHelper_Test
    Test Class: 

    History
    <Date>          <Authors Name>          <Brief Description of Change>   
    Oct-02-2024     Vignesh                  Initial Development                
--------------------------------------------------------------------*/
@isTest
public with sharing class AccountAfterTriggerHelper_Test {
    
    @testSetup
    static void makeData() {  
        Account acctRecord = DataFactoryTest.createBusinessAccount();
        insert acctRecord;

        Opportunity opp = DataFactoryTest.createOpportunity();
        opp.AccountId = acctRecord.Id;
        opp.StageName = 'Ready To Close';
        insert opp;
    }

    /**
     * @description: Cover the feature which is creating the account team members for the closers
    **/
    @isTest
    static void createAccountTeamMembersForClosers() {
        Id profileId = [SELECT Id FROM Profile WHERE Name = 'System Administrator'].Id;
        User userInstance = DataFactoryTest.createUser(profileId);
        userInstance.Twilio_Phone__c = '6498345678';
        userInstance.User_Country__c = 'United States';
        insert userInstance;

        List<AccountTeamMember> accountTeamMembers = [SELECT Id FROM AccountTeamMember];
        Assert.areEqual(1, accountTeamMembers.size(), 'Verifying no account team members are there.');

        List<Opportunity> opps = [SELECT Id FROM Opportunity];
        opps[0].OwnerId = userInstance.Id;
        Test.startTest();
        update opps[0];
        Test.stopTest();

        List<AccountTeamMember> accountTeamMembersToVerify = [SELECT Id, UserId FROM AccountTeamMember ORDER BY CreatedDate DESC];
        Assert.areEqual(1, accountTeamMembersToVerify.size(), 'Verifying no account team members are there.');
        Assert.areEqual(userInstance.Id, accountTeamMembersToVerify[0].UserId, 'Verifying the User Id in account team member');
    }
    
    @isTest
    static void updateOppRecordTypeToBuyout_Test(){
        Account acctRecord = DataFactoryTest.createBusinessAccount();
        acctRecord.Name = 'Test Account';
        acctRecord.SSN__c = '123456780';
        acctRecord.Phone = '123-456-7890' ;
        acctRecord.Lead_Number__c = '123456';
        acctRecord.Program_Start_Date__c = Date.today();
        acctRecord.Program_End_Date__c = Date.today().addDays(30); 
        acctRecord.RecordTypeId = ApexUtil.getRecordTypeIdbyDeveloperName('Account', 'Business_Account');
        acctRecord.BillingStreet = 'Ap #696-3279 Viverra. Avenue';
        acctRecord.BillingCity = 'Latrobe';
        acctRecord.BillingStateCode = 'DE';
        acctRecord.BillingPostalCode = '38100'; 
        acctRecord.BillingCountryCode = 'US';
        insert acctRecord;
        
        Opportunity opp = DataFactoryTest.createOpportunity();
        opp.AccountId = acctRecord.Id;
        opp.StageName = 'Ready To Close';
        insert opp;
        
        Opportunity oppToUpdate = New Opportunity();
        oppToUpdate.Id = opp.Id;
        oppToUpdate.StageName = 'Archived';
        oppToUpdate.Sub_Disposition__c = 'High UCC Risk';
        update oppToUpdate;
        
        Id oppBuyoutRecordTypeId = ApexUtil.getRecordTypeIdbyDeveloperName('Opportunity','Buyout');
        Opportunity oppRecord = [SELECT Id ,RecordTypeId FROM Opportunity WHERE Id = : opp.Id LIMIT 1];
    }
    
    @isTest
    static void updateOppRecordTypeToBuyout_TestFail(){
        Account acctRecord = DataFactoryTest.createBusinessAccount();
        acctRecord.Name = 'Test Account';
        acctRecord.SSN__c = '123456780';
        acctRecord.Phone = '123-456-7890' ;
        acctRecord.Lead_Number__c = '1234567';
        acctRecord.Program_Start_Date__c = Date.today();
        acctRecord.Program_End_Date__c = Date.today().addDays(30); 
        acctRecord.RecordTypeId = ApexUtil.getRecordTypeIdbyDeveloperName('Account', 'Business_Account');
        acctRecord.BillingStreet = 'Ap #696-3279 Viverra. Avenue';
        acctRecord.BillingCity = 'Latrobe';
        acctRecord.BillingStateCode = 'DE';
        acctRecord.BillingPostalCode = '38100'; 
        acctRecord.BillingCountryCode = 'US';
        insert acctRecord;
        
        Opportunity opp = DataFactoryTest.createOpportunity();
        opp.AccountId = acctRecord.Id;
        opp.StageName = 'Closed Lost';
        insert opp;
        
        Opportunity oppToUpdate = New Opportunity();
        oppToUpdate.Id = opp.Id;
        oppToUpdate.StageName = 'Archived';
        oppToUpdate.Sub_Disposition__c = 'High UCC Risk';
        update oppToUpdate;
        
        Id oppBuyoutRecordTypeId = ApexUtil.getRecordTypeIdbyDeveloperName('Opportunity','Buyout');
        Opportunity oppRecord = [SELECT Id ,RecordTypeId FROM Opportunity WHERE Id = : opp.Id LIMIT 1];
        
        Assert.areNotEqual(oppRecord.RecordTypeId,oppBuyoutRecordTypeId);
    }
}