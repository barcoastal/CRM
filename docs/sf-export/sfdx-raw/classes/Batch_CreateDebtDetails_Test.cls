@isTest
private class Batch_CreateDebtDetails_Test {
    
    @isTest
    static void Batch_CreateDebtDetails_Success() {
        
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());
        Lead newLead = DataFactoryTest.createListLead();
        newLead.External_Legacy_CRM_Id__c = '2431973';
        insert newLead;

        Account newAcc = DataFactoryTest.createBusinessAccount();
        newAcc.External_Legacy_CRM_Id__c = '2436695';
        insert newAcc;

        Opportunity newOpp = DataFactoryTest.createOpportunity();
        newOpp.External_Legacy_CRM_Id__c = '2436695';
        newOpp.AccountId = newAcc.Id;
        insert newOpp;

        Contact newCon = DataFactoryTest.createContact();
        newCon.External_Legacy_CRM_Id__c = '2436695';
        newCon.AccountId = newAcc.Id;
        insert newCon;

        Payment_Processor__c newProcessor = DataFactoryTest.createPaymentProcessor();
        insert newProcessor;

        Program_Plan__c newProgramPlan = DataFactoryTest.createProgramPlan(newOpp.Id, newAcc.Id, newProcessor.Id);
        newProgramPlan.External_Legacy_CRM_Id__c = '2436695';
        insert newProgramPlan;

        LegacyCRMDebtDetail__c crmDebtDetailLead = new LegacyCRMDebtDetail__c();
        crmDebtDetailLead.Deal_Id__c = '2436695';
        crmDebtDetailLead.Lender_Name__c = 'Mca doestn remember';
        crmDebtDetailLead.Amount_Owed__c = 100000;
        crmDebtDetailLead.Payment_Amount__c = 5000;
        crmDebtDetailLead.Frequency__c = 'Weekly';
        crmDebtDetailLead.Lender_Id__c = '764574';
        
        LegacyCRMDebtDetail__c crmDebtDetailOpp = new LegacyCRMDebtDetail__c();
        crmDebtDetailOpp.Deal_Id__c = '2431973';
        crmDebtDetailOpp.Lender_Name__c = 'Pac Western';
        crmDebtDetailOpp.Amount_Owed__c = 8000;
        crmDebtDetailOpp.Payment_Amount__c = 265;
        crmDebtDetailOpp.Frequency__c = 'Daily';
        crmDebtDetailLead.Lender_Id__c = '764577';
        
        insert new List<LegacyCRMDebtDetail__c>{crmDebtDetailLead, crmDebtDetailOpp};

        Test.startTest();
        Database.executeBatch(new Batch_CreateDebtDetails());
        Test.stopTest();

        Lead verifyLead = [
            SELECT Id, Creditor_1_Name__c, Creditor_1_Payment_Frequency__c, Creditor_1_Payment__c, 
            Creditor_1_Total_Debt__c, External_Legacy_CRM_Id__c FROM Lead
        ];

        System.assertEquals('2431973', verifyLead.External_Legacy_CRM_Id__c);
        System.assertEquals('Pac Western', verifyLead.Creditor_1_Name__c);
        System.assertEquals('Daily', verifyLead.Creditor_1_Payment_Frequency__c);
        System.assertEquals(265, verifyLead.Creditor_1_Payment__c);
        System.assertEquals(8000, verifyLead.Creditor_1_Total_Debt__c);
        /*Debt_Details__c verifyDebtDetail = [SELECT Id, Creditor_Name__c, Debt_Amount__c, Payment_Frequency__c, Payment__c FROM Debt_Details__c];

        System.assertEquals('Mca doestn remember', verifyDebtDetail.Creditor_Name__c);
        System.assertEquals('Weekly', verifyDebtDetail.Payment_Frequency__c);
        System.assertEquals(5000, verifyDebtDetail.Payment__c);
        System.assertEquals(100000, verifyDebtDetail.Debt_Amount__c);
        
        List<LegacyCRMDebtDetail__c> verifyCRMDebtDetails = [SELECT Id, Converted_to_Lead__c, Converted_to_Debt_Detail__c FROM LegacyCRMDebtDetail__c];
        
        System.assertEquals(true, verifyCRMDebtDetails[0].Converted_to_Debt_Detail__c);
        System.assertEquals(true, verifyCRMDebtDetails[1].Converted_to_Lead__c);*/
    }
}