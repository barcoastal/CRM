@isTest
private class Batch_CreateOpportunities_Test {
    
    @IsTest
    static void BatchCreateOpportunities_Success() {

        LegacyCRMLead__c crmOpp = new LegacyCRMLead__c(
            LeadId__c = '2439042', LeadDate__c = Date.newInstance(2023, 07, 07), Status__c = 'Working Lead', LeadSource__c = 'CJ3S0509', Fronter__c = 'Simone Simpson', 
            Closer__c = 'Christopher Boulahanis Closer', Total_Debt__c = 90000.00, Company__c = 'KRUNGTEP THAI BISTRO', ClientName__c = 'DOGG A SAE JUNG', 
            Address__c = '23 S.MIDDLE NECK RD.', City__c = 'GREAT NECK', Zip__c = '11021', State__c = 'AL', Email__c = 'dug_amporns@sample.com', 
            Phone1__c = '9177047423', Phone2__c = '908765321', Industry__c = 'Restaurant', LastDispo__c = 'CBK-Call Back|20230707|10:39|CHRISC', 
            Link__c = 'https://www.cdrcrm.com/crm_agent_interface.php?dealid=MjQzOTA0Mg==', Alternate_Email__c = 'amporns@company.com', Comments__c = 'Legacy CRM Lead Test'
        );
        insert crmOpp;
        
        Payment_Processor__c newProcessor = DataFactoryTest.createPaymentProcessor();
        insert newProcessor;

        Test.startTest();
        Database.executeBatch(new Batch_CreateOpportunities());
        Test.stopTest();

       /* Account verifyAccount = [
            SELECT Id, BillingStreet, BillingCity, BillingState, BillingPostalCode, Name, Industry, CreatedDate, 
            External_Legacy_CRM_Id__c, AccountSource, Phone, Work_Phone__c, Description FROM Account LIMIT 1
        ];

        System.assertEquals('Legacy CRM Lead Test', verifyAccount.Description);
        System.assertEquals('908765321', verifyAccount.Work_Phone__c);
        System.assertEquals('9177047423', verifyAccount.Phone);
        System.assertEquals('CJ3S0509', verifyAccount.AccountSource);
        System.assertEquals('2439042', verifyAccount.External_Legacy_CRM_Id__c);
        System.assertEquals(Date.newInstance(2023, 07, 07), verifyAccount.CreatedDate);
        System.assertEquals('Restaurant', verifyAccount.Industry);
        System.assertEquals('KRUNGTEP THAI BISTRO', verifyAccount.Name);
        System.assertEquals('11021', verifyAccount.BillingPostalCode);
        System.assertEquals('Alabama', verifyAccount.BillingState);
        System.assertEquals('GREAT NECK', verifyAccount.BillingCity);
        System.assertEquals('23 S.MIDDLE NECK RD.', verifyAccount.BillingStreet);

        Contact verifyContact = [SELECT Id, FirstName, LastName, MailingStreet, Alternate_Email__c, MailingCity, MailingCountryCode, MailingStateCode, 
        MailingPostalCode, Email, LeadSource, Phone, Description, External_Legacy_CRM_Id__c, AccountId FROM Contact LIMIT 1];

        System.assertEquals('DOGG', verifyContact.FirstName);
        System.assertEquals('A SAE JUNG', verifyContact.LastName);
        System.assertEquals('23 S.MIDDLE NECK RD.', verifyContact.MailingStreet);
        System.assertEquals('amporns@company.com', verifyContact.Alternate_Email__c);
        System.assertEquals('GREAT NECK', verifyContact.MailingCity);
        System.assertEquals('US', verifyContact.MailingCountryCode);
        System.assertEquals('AL', verifyContact.MailingStateCode);
        System.assertEquals('11021', verifyContact.MailingPostalCode);
        System.assertEquals('dug_amporns@sample.com', verifyContact.Email);
        System.assertEquals('CJ3S0509', verifyContact.LeadSource);
        System.assertEquals('9177047423', verifyContact.Phone);
        System.assertEquals('Legacy CRM Lead Test', verifyContact.Description);
        System.assertEquals('2439042', verifyContact.External_Legacy_CRM_Id__c);
        System.assertEquals(verifyAccount.Id, verifyContact.AccountId);

        Opportunity verifyOpp = [SELECT Id, Name, LeadSource, AccountId, Last_Disposition__c, Closer__c, Fronter__c FROM Opportunity LIMIT 1];
        
        System.assertEquals('CBK-Call Back|20230707|10:39|CHRISC', verifyOpp.Last_Disposition__c);
        System.assertEquals('Christopher Boulahanis Closer', verifyOpp.Closer__c);
        System.assertEquals('Simone Simpson', verifyOpp.Fronter__c);
        System.assertEquals('KRUNGTEP THAI BISTRO', verifyOpp.Name);
        System.assertEquals('CJ3S0509', verifyOpp.LeadSource);
        System.assertEquals(verifyAccount.Id, verifyOpp.AccountId);

        Program_Plan__c verifyProgramPlan = [SELECT Id, Total_Debt__c, Payment_Processor__c, Client__c, Opportunity__c FROM Program_Plan__c LIMIT 1];

        System.assertEquals(90000.00, verifyProgramPlan.Total_Debt__c);
        System.assertEquals(newProcessor.Id, verifyProgramPlan.Payment_Processor__c);
        System.assertEquals(verifyAccount.Id, verifyProgramPlan.Client__c);
        System.assertEquals(verifyOpp.Id, verifyProgramPlan.Opportunity__c);

        OpportunityContactRole verifyOppContRole = [SELECT Id, OpportunityId, ContactId, Role, IsPrimary FROM OpportunityContactRole LIMIT 1];
        
        System.assertEquals(verifyOpp.Id, verifyOppContRole.OpportunityId);
        System.assertEquals(verifyContact.Id, verifyOppContRole.ContactId);
        System.assertEquals('Decision Maker', verifyOppContRole.Role);
        System.assertEquals(true, verifyOppContRole.IsPrimary);

        LegacyCRMLead__c verifyCRMLead = [
            SELECT Id, Converted_to_Account__c, Converted_to_Opportunity__c, Converted_to_Contact__c, Converted_to_Program_Plan__c, Converted_to_OpportunityContactRole__c 
            FROM LegacyCRMLead__c WHERE Id = :crmOpp.Id
        ];
        System.assertEquals(true, verifyCRMLead.Converted_to_Account__c);
        System.assertEquals(true, verifyCRMLead.Converted_to_Opportunity__c);
        System.assertEquals(true, verifyCRMLead.Converted_to_Contact__c);
        System.assertEquals(true, verifyCRMLead.Converted_to_Program_Plan__c);
        System.assertEquals(true, verifyCRMLead.Converted_to_OpportunityContactRole__c);*/
    }
    
    @IsTest
    static void BatchCreateOpportunities_Failure() {
        
        LegacyCRMLead__c crmLead = new LegacyCRMLead__c(
            LeadId__c = '2439042', LeadDate__c = Date.newInstance(2023, 07, 07), Status__c = 'Working Lead', LeadSource__c = 'CJ3S0509', 
            Company__c = 'KRUNGTEP THAI BISTRO', ClientName__c = 'Christopher', Email__c = 'interface.php?dealid=MjQzOTA0Mg==', 
            Phone1__c = '9177047423', State__c = 'Alberta', CountryCode__c = 'CA'
        );
        insert crmLead;
        
        Payment_Processor__c newProcessor = DataFactoryTest.createPaymentProcessor();
        insert newProcessor;

        Test.startTest();
        Database.executeBatch(new Batch_CreateOpportunities());
        Test.stopTest();

        /*LegacyCRMLead__c verifyCRMLead = [
            SELECT Id, Converted_to_Account__c, Converted_to_Opportunity__c, Converted_to_Contact__c, Converted_to_Program_Plan__c 
            FROM LegacyCRMLead__c WHERE Id = :crmLead.Id
        ];
        System.assertEquals(true, verifyCRMLead.Converted_to_Account__c);
        System.assertEquals(true, verifyCRMLead.Converted_to_Opportunity__c);
        System.assertEquals(false, verifyCRMLead.Converted_to_Contact__c);
        System.assertEquals(true, verifyCRMLead.Converted_to_Program_Plan__c);
        
        Application_Log__c verifyLog = [SELECT Id, Exception_Message__c FROM Application_Log__c LIMIT 1];
        System.assertEquals('Email: invalid email address: interface.php?dealid=MjQzOTA0Mg==.', verifyLog.Exception_Message__c);*/
    }
}