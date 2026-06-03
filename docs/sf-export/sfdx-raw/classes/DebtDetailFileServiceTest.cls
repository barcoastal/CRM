@isTest
public with sharing class DebtDetailFileServiceTest {

    @testSetup
    static void makeData() {
        Account acct = DataFactoryTest.createAccount();
        insert acct;

        Opportunity opp = DataFactoryTest.createOpportunity();
        opp.AccountId = acct.Id;
        insert opp;

        Payment_Processor__c pp = DataFactoryTest.createPaymentProcessor();
        insert pp;

        Program_Plan__c programPlan = DataFactoryTest.createProgramPlan(opp.Id, acct.Id, pp.Id);
        insert programPlan;

        Debt_Details__c parentDetail = DataFactoryTest.createDebtDetails(programPlan.Id);
        parentDetail.Opportunity__c = opp.Id;
        insert parentDetail;

        Debt_Details__c childDetail = DataFactoryTest.createDebtDetails(programPlan.Id);
        childDetail.Opportunity__c = opp.Id;
        childDetail.Parent_Debt_Detail__c = parentDetail.Id;
        insert childDetail;

        ContentVersion cv = new ContentVersion(
            Title = 'TestFile',
            VersionData = Blob.valueOf('Test Content'),
            PathOnClient = 'TestFile.txt'
        );
        insert cv;

        Id contentDocumentId = [SELECT ContentDocumentId FROM ContentVersion WHERE Id = :cv.Id].ContentDocumentId;

        ContentDocumentLink cdl = new ContentDocumentLink();
        cdl.ContentDocumentId = contentDocumentId;
        cdl.LinkedEntityId = parentDetail.Id;
        insert cdl;
    }

    @isTest
    static void testCopiesFileFromParentToChild() {
        Opportunity opp = [SELECT Id FROM Opportunity LIMIT 1];
        Debt_Details__c childDetail = [SELECT Id FROM Debt_Details__c WHERE Parent_Debt_Detail__c != null LIMIT 1];

        Test.startTest();
        DebtDetailFileService.copyFilesFromParentToChildDebtDetails(new Set<Id>{ opp.Id });
        Test.stopTest();

        List<ContentDocumentLink> childCDLs = [
            SELECT Id FROM ContentDocumentLink WHERE LinkedEntityId = :childDetail.Id
        ];
        Assert.areEqual(1, childCDLs.size(), 'File should be copied from parent to child debt detail');
    }

    @isTest
    static void testNoChildDetailsDoesNothing() {
        Opportunity opp = [SELECT Id FROM Opportunity LIMIT 1];
        Debt_Details__c childDetail = [SELECT Id FROM Debt_Details__c WHERE Parent_Debt_Detail__c != null LIMIT 1];
        childDetail.Parent_Debt_Detail__c = null;
        update childDetail;

        Test.startTest();
        DebtDetailFileService.copyFilesFromParentToChildDebtDetails(new Set<Id>{ opp.Id });
        Test.stopTest();

        List<ContentDocumentLink> childCDLs = [
            SELECT Id FROM ContentDocumentLink WHERE LinkedEntityId = :childDetail.Id
        ];
        Assert.areEqual(0, childCDLs.size(), 'No files should be copied when there are no child debt details');
    }

    @isTest
    static void testParentWithNoFilesDoesNothing() {
        Opportunity opp = [SELECT Id FROM Opportunity LIMIT 1];
        Debt_Details__c parentDetail = [SELECT Id FROM Debt_Details__c WHERE Parent_Debt_Detail__c = null LIMIT 1];
        Debt_Details__c childDetail = [SELECT Id FROM Debt_Details__c WHERE Parent_Debt_Detail__c != null LIMIT 1];

        delete [SELECT Id FROM ContentDocumentLink WHERE LinkedEntityId = :parentDetail.Id];

        Test.startTest();
        DebtDetailFileService.copyFilesFromParentToChildDebtDetails(new Set<Id>{ opp.Id });
        Test.stopTest();

        List<ContentDocumentLink> childCDLs = [
            SELECT Id FROM ContentDocumentLink WHERE LinkedEntityId = :childDetail.Id
        ];
        Assert.areEqual(0, childCDLs.size(), 'No files should be copied when parent has no files');
    }
    @isTest
    static void testExceptionIsHandledGracefully() {
        Test.startTest();
        try {
            DebtDetailFileService.throwExceptionForTest = true;
            DebtDetailFileService.copyFilesFromParentToChildDebtDetails(null);
            Assert.isTrue(true, 'Exception should be caught internally and not propagate');
        } catch (Exception e) {
            Assert.fail('Exception should have been caught inside the service, not propagated: ' + e.getMessage());
        }
        Test.stopTest();
    }
}