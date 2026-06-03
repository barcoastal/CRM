/**
 * Description: Batch class to create Account, Contact, Opportunity and Program Plan from the LegacyCRMLead__c object.
 * Based on the leagcy crm Lead status, either Lead or Account, Contact, Opportunity and Program Plan will be created.
 * If Account exists with the same legacy CRM lead Id, those records will be updated and no Contact, Opportunity and Program Plan will be created
 */
//Commented the code as part of the deployment(CRM-2170), as the batch class is not used any where. Will be uncommented and deployed once the batch class is needed.
public with sharing class Batch_CreateOpportunities implements Database.Batchable<SObject> {
    
    // Legacy CRM Lead with the below statuses will be created as Account.
   /* private static Map<String, String> crmStatusWithOppStage = new Map<String, String>{
        'App Pool'=>'App Pool', 'Closer Pool'=>'New Bucket', 'Working Lead'=>'Working opportunity', 'Waiting for Agreements'=>'Waiting for Agreements', 
        'Agreements Received'=>'Agreements Received', 'Ready to Close'=>'Ready to Close', 'Contract Sent'=>'Contract Sent', 'Lead Terminated'=>'Archived', 
        'Closed Won'=>'Closed Won - First Payment Completed', 'Closed Lost'=>'Closed Lost', 'DNC'=>'DNC', 'Leads Cloud'=>'Leads Cloud'
    };

    private static Set<String> crmStatusSet = crmStatusWithOppStage.keySet();
    
    public String filterCriteria;
    
    public Batch_CreateOpportunities() {
        //Empty Constructor
    }
    
    public Batch_CreateOpportunities(String filterCondition) {
        this.filterCriteria = filterCondition;
    }*/

    // Start method to query the Legacy CRM Lead records.
    public Database.QueryLocator start(Database.BatchableContext bc){
        
        String query = 'SELECT Id, Name, LeadId__c, LeadDate__c, Status__c, LeadSource__c, Fronter__c, Closer__c, '
        +'Total_Debt__c, Company__c, ClientName__c, Address__c, City__c, Zip__c, State__c, Email__c, Phone1__c, '
        +'Phone2__c, Industry__c, LastDispo__c, Link__c, Alternate_Email__c, Comments__c, Converted_to_Account__c, '
        +'Converted_to_Contact__c, Converted_to_Opportunity__c, Converted_to_Program_Plan__c, CountryCode__c FROM LegacyCRMLead__c ';
        //+'WHERE Status__c IN :crmStatusSet';
        
        /*if (String.isNotBlank(filterCriteria)) {
            query += ' ' +filterCriteria;
        }*/
        return Database.getQueryLocator(query);
    }

    // Execute method to upsert the Lead or Account based on the Legacy CRM Lead records.
    public void execute(Database.BatchableContext bc, List<LegacyCRMLead__c> scope) {
		
        /*Map<String, LegacyCRMLead__c> customLeadMap = new Map<String, LegacyCRMLead__c>();
        Map<String, Account> accountMap = new Map<String, Account>();
        Map<String, Opportunity> opportunityMap = new Map<String, Opportunity>();
        Map<String, Contact> contactMap = new Map<String, Contact>();
        List<OpportunityContactRole> oppContactRoleList = new List<OpportunityContactRole>();
        List<Program_Plan__c> programPlanList = new List<Program_Plan__c>();
        List<String> convertedAccCRMId = new List<String>();
        List<String> convertedOppCRMId = new List<String>();
        Map<Id, LegacyCRMLead__c> crmLeadToUpdate = new Map<Id, LegacyCRMLead__c>();
        Map<String, Id> userNameWithIdMap = new Map<String, Id>();
        Set<String> closerSet = new Set<String>();

        FOR (LegacyCRMLead__c clInstance : scope) {
            IF (String.isNotBlank(clInstance.Closer__c)) {
                closerSet.add(clInstance.Closer__c);
            }
        }

        FOR (User userInstance : [SELECT Id, Name FROM User WHERE Name IN :closerSet]) {
            userNameWithIdMap.put(userInstance.Name, userInstance.Id);
        }
        
        try {
            for (LegacyCRMLead__c clInstance : scope) {

                //create account instance and adding in the map
                accountMap.put(clInstance.LeadId__c, createAccountInstance(clInstance));
                
                // forming the map of crm lead id with crm lead instance to use in the creation of contact and opportunity
                customLeadMap.put(clInstance.LeadId__c, clInstance);
            }
            
            if (!accountMap.values().isEmpty()) {
                upsertAccounts(accountMap.values(), scope, crmLeadToUpdate, convertedAccCRMId);
            }
            
            //To create Contact and Opportunity Instances only if the Account was created.
            if (!convertedAccCRMId.isEmpty()) {
    
                for (String externalLeadId : convertedAccCRMId) {
    
                    if (accountMap.get(externalLeadId) != null && accountMap.get(externalLeadId).Id != null) {
    
                        LegacyCRMLead__c clInstance = customLeadMap.get(externalLeadId);
    
                        //creating contact instance and adding it in map
                        contactMap.put(clInstance.LeadId__c, createContactInstance(accountMap.get(externalLeadId).Id, clInstance));
    
                        //creating opportunity instance and adding it in map
                        opportunityMap.put(clInstance.LeadId__c, createOpportunityInstance(accountMap.get(externalLeadId).Id, clInstance, userNameWithIdMap));
                    }
                }
            }
    
            if (!contactMap.values().isEmpty()) {
                upsertContacts(contactMap.values(), customLeadMap, crmLeadToUpdate, convertedAccCRMId);
            }
    
            if (!opportunityMap.values().isEmpty()) {
                upsertOpportunities(opportunityMap.values(), customLeadMap, crmLeadToUpdate, convertedOppCRMId, convertedAccCRMId);
            }
            
            // To create program plan && OpportunityContactRole record Instances only if the opportunity was saved.
            if (!convertedOppCRMId.isEmpty()) {
    
                // Retrieved the payment processor Id to assign in program plan as it is a required field.
                Id paymentProcessorId = [SELECT Id FROM Payment_Processor__c LIMIT 1].Id;
    
                Map<Id, Set<Id>> oppIdWithConIdsMap = new Map<Id, Set<Id>>();
    
                //retrieve the existing opportunity contact role to prevent creating duplicate records.
                for (OpportunityContactRole oppContRole : [SELECT Id, OpportunityId, ContactId, Role, IsPrimary 
                    FROM OpportunityContactRole WHERE OpportunityId IN :opportunityMap.values()
                ]) {
                    if (!oppIdWithConIdsMap.containsKey(oppContRole.OpportunityId)) {
                        oppIdWithConIdsMap.put(oppContRole.OpportunityId, new Set<Id>());
                    }
                    oppIdWithConIdsMap.get(oppContRole.OpportunityId).add(oppContRole.ContactId);
                }
    
                for (String externalLeadId : convertedOppCRMId) {
    
                    Opportunity opp = opportunityMap.get(externalLeadId);
    
                    if (opp != null && opp.Id != null) {
                        
                        //creating program plan instance in a method and adding it in list.
                        //params: Opportunity instance, Payment Processor Id, CRM Lead Id, CRM Lead Instance
                        programPlanList.add(
                            createProgramPlanInstance(opp, paymentProcessorId, externalLeadId, customLeadMap.get(externalLeadId))
                        );
    
                        if (!contactMap.values().isEmpty()) {
                            if (!oppIdWithConIdsMap.isEmpty() && oppIdWithConIdsMap.containsKey(opp.Id) 
                                && oppIdWithConIdsMap.get(opp.Id).contains(contactMap.get(externalLeadId).Id)
                            ) {
                                //if duplicate found, skip the record
                                continue;
                            }
                            //creating opportunity contact role istance in a method and adding it is a list.
                            oppContactRoleList.add(createOCRInstance(opp.Id, contactMap.get(externalLeadId).Id));
                        }
                    }
                }
            }
    
            if (!programPlanList.isEmpty()) {
                upsertProgramPlans(programPlanList, customLeadMap, crmLeadToUpdate, convertedOppCRMId);
            }
    
            if (!oppContactRoleList.isEmpty()) {
                createOpportunityContactRoles(oppContactRoleList, customLeadMap, crmLeadToUpdate, convertedOppCRMId);
            }
    
            if (!crmLeadToUpdate.values().isEmpty()) {
                updateLegacyCRMLead(crmLeadToUpdate.values());
            }
            
            //insert all the application logs captured in the execution
        	ApplicationLogger.insertStoredLogs();
            
        } catch (Exception exp) {
            ApplicationLogger.logException(exp, null);
        }*/
    }

    public void finish(Database.BatchableContext bc) {
        // execute the successor batch to create debt details from the legacy crm data.
		//Database.executeBatch(new Batch_CreateDebtDetails());
    }

   /* private Account createAccountInstance(LegacyCRMLead__c clInstance) {
        Account newAcc = new Account();
        newAcc.BillingStreet = clInstance.Address__c;
        newAcc.BillingCity = clInstance.City__c;
        if (String.isNotBlank(clInstance.CountryCode__c)) {
            newAcc.BillingCountryCode = clInstance.CountryCode__c;
        } else {
            newAcc.BillingCountryCode = 'US';
        }
        if (String.isNotBlank(clInstance.State__c)) {
            if (clInstance.State__c.length() == 2) {
                newAcc.BillingStateCode = clInstance.State__c;
            } else {
                newAcc.BillingState = clInstance.State__c;
            }
        }
        newAcc.BillingPostalCode = clInstance.Zip__c;
        newAcc.Name = String.isNotBlank(clInstance.Company__c) ? clInstance.Company__c : (String.isNotBlank(clInstance.ClientName__c) ? clInstance.ClientName__c : 'Blank Company - '+clInstance.LeadId__c);
        newAcc.Industry = clInstance.Industry__c;
        if (!clInstance.Converted_to_Account__c) {
            newAcc.CreatedDate = clInstance.LeadDate__c;
        }
        newAcc.External_Legacy_CRM_Id__c = clInstance.LeadId__c;
        newAcc.AccountSource = clInstance.LeadSource__c;
        newAcc.Phone = clInstance.Phone1__c;
        newAcc.Work_Phone__c = clInstance.Phone2__c;
        newAcc.Description = clInstance.Comments__c;
        return newAcc;
    }

    private Contact createContactInstance(Id accId, LegacyCRMLead__c clInstance) {
        Contact newCon = new Contact();
        if (String.isNotBlank(clInstance.ClientName__c)) {
            if (clInstance.ClientName__c.split(' ', 2).size() > 1 ) {
                newCon.FirstName = clInstance.ClientName__c.split(' ', 2)[0];
                newCon.LastName = clInstance.ClientName__c.split(' ', 2)[1];
            } else {
                newCon.LastName = clInstance.ClientName__c;
            }
        } else {
            newCon.LastName = 'Blank Client Name - '+clInstance.LeadId__c;
        }
        newCon.Alternate_Email__c = clInstance.Alternate_Email__c;
        newCon.MailingStreet = clInstance.Address__c;
        newCon.MailingCity = clInstance.City__c;
        if (String.isNotBlank(clInstance.CountryCode__c)) {
            newCon.MailingCountryCode = clInstance.CountryCode__c;
        } else {
            newCon.MailingCountryCode = 'US';
        }
        if (String.isNotBlank(clInstance.State__c)) {
            if (clInstance.State__c.length() == 2) {
                newCon.MailingStateCode = clInstance.State__c;
            } else {
                newCon.MailingState = clInstance.State__c;
            }
        }
        newCon.MailingPostalCode = clInstance.Zip__c;
        newCon.Email = clInstance.Email__c;
        newCon.LeadSource = clInstance.LeadSource__c; 
        newCon.Phone = clInstance.Phone1__c;
        newCon.Description = clInstance.Comments__c;
        newCon.External_Legacy_CRM_Id__c = clInstance.LeadId__c;
        newCon.AccountId = accId;
        if (!clInstance.Converted_to_Contact__c) {
            newCon.CreatedDate = clInstance.LeadDate__c;
        }
        return newCon;
    }

    private Opportunity createOpportunityInstance(Id accId, LegacyCRMLead__c clInstance, Map<String, Id> userNameWithIdMap) {
        Opportunity newOpp = new Opportunity();
        newOpp.Name = String.isNotBlank(clInstance.Company__c) ? clInstance.Company__c : (String.isNotBlank(clInstance.ClientName__c) ? clInstance.ClientName__c : 'Blank Company - '+clInstance.LeadId__c);
        newOpp.LeadSource = clInstance.LeadSource__c;
        newOpp.AccountId = accId;
        newOpp.Last_Disposition__c = clInstance.LastDispo__c;
        newOpp.Fronter__c = clInstance.Fronter__c;
        newOpp.Closer__c = clInstance.Closer__c;
        newOpp.External_Legacy_CRM_Id__c = clInstance.LeadId__c;
        newOpp.StageName = crmStatusWithOppStage.get(clInstance.Status__c);
        if (crmStatusWithOppStage.get(clInstance.Status__c) == 'Closed Won') {
            newOpp.CloseDate = Date.newInstance(2023, 08, 15);
        } else {
            newOpp.CloseDate = Date.newInstance(2023, 08, 15).addYears(1);
        }
        if (!clInstance.Converted_to_Opportunity__c) {
            newOpp.CreatedDate = clInstance.LeadDate__c;
        }
        if (String.isNotBlank(clInstance.Closer__c) && userNameWithIdMap.containsKey(clInstance.Closer__c)) {
            newOpp.OwnerId = userNameWithIdMap.get(clInstance.Closer__c);
        }
        return newOpp;
    }

    private Program_Plan__c createProgramPlanInstance(Opportunity opp, Id paymentProcessorId, String externalLeadId, LegacyCRMLead__c clInstance) {
        Program_Plan__c newProgramPlan = new Program_Plan__c();
        newProgramPlan.Total_Debt__c = clInstance.Total_Debt__c;
        newProgramPlan.Payment_Processor__c = paymentProcessorId;
        newProgramPlan.Client__c = opp.AccountId;
        newProgramPlan.Opportunity__c = opp.Id;
        if (!clInstance.Converted_to_Program_Plan__c) {
            newProgramPlan.CreatedDate = clInstance.LeadDate__c;
        }
        newProgramPlan.External_Legacy_CRM_Id__c = externalLeadId;
        return newProgramPlan;
    }

    private OpportunityContactRole createOCRInstance(Id oppId, Id conId) {
        OpportunityContactRole newOCR = new OpportunityContactRole();
        newOCR.OpportunityId = oppId;
        newOCR.ContactId = conId;
        newOCR.Role = 'Decision Maker';
        newOCR.IsPrimary = true;
        return newOCR;
    }

    //Upsert all the account records from legacy CRM based on the external lead Id.
    private void upsertAccounts(List<Account> accountList, List<LegacyCRMLead__c> originalCRMLeadList, Map<Id, LegacyCRMLead__c> crmLeadToUpdate, List<String> convertedAccCRMId) {
        Integer i = 0;
        for (Database.UpsertResult urAccount : Database.upsert(accountList, Account.Fields.External_Legacy_CRM_Id__c, false)) {
            Id crmLeadSFId = originalCRMLeadList[i].Id;
            if (urAccount.isSuccess()) {          
                LegacyCRMLead__c crmLead = crmLeadToUpdate.containsKey(crmLeadSFId) ? crmLeadToUpdate.get(crmLeadSFId) : new LegacyCRMLead__c(Id = crmLeadSFId);
                crmLead.Converted_to_Account__c = true;
                crmLeadToUpdate.put(crmLeadSFId, crmLead);
                convertedAccCRMId.add(originalCRMLeadList[i].LeadId__c);
            } else {
                String errorMessage = '';
                for (Database.Error err : urAccount.getErrors()) {
                    errorMessage += err.getMessage() + '. ';
                }
                ApplicationLogger.logDMLException('Conversion from Legacy CRM Lead to Account is failed', crmLeadSFId, errorMessage, true);
            }
            i++;
        }
    }

    //Upsert all the contact records from legacy CRM based on the external lead Id.
    private void upsertContacts(List<Contact> contactList, Map<String, LegacyCRMLead__c> customLeadMap, Map<Id, LegacyCRMLead__c> crmLeadToUpdate, List<String> convertedAccCRMId) {
        Integer j = 0;
        for (Database.UpsertResult urContact : Database.upsert(contactList, Contact.Fields.External_Legacy_CRM_Id__c, false)) {
            Id crmLeadId = customLeadMap.get(convertedAccCRMId[j]).Id;
            if (urContact.isSuccess()) {          
                LegacyCRMLead__c crmLead = crmLeadToUpdate.containsKey(crmLeadId) ? crmLeadToUpdate.get(crmLeadId) : new LegacyCRMLead__c(Id = crmLeadId);
                crmLead.Converted_to_Contact__c = true;
                crmLeadToUpdate.put(crmLeadId, crmLead);
            } else {
                String errorMessage = '';
                for (Database.Error err : urContact.getErrors()) {
                    errorMessage += err.getMessage() + '. ';
                }
                ApplicationLogger.logDMLException('Conversion from Legacy CRM Lead to Contact is failed', crmLeadId, errorMessage, true);
            }
            j++;
        }
    }

    //Upsert all the opportunity records from legacy CRM based on the external lead Id.
    private void upsertOpportunities(List<Opportunity> opportunityList, Map<String, LegacyCRMLead__c> customLeadMap, Map<Id, LegacyCRMLead__c> crmLeadToUpdate, List<String> convertedOppCRMId, List<String> convertedAccCRMId) {
        Integer k = 0;
        for (Database.UpsertResult urOpportunity : Database.upsert(opportunityList, Opportunity.Fields.External_Legacy_CRM_Id__c, false)) {
            Id crmLeadId = customLeadMap.get(convertedAccCRMId[k]).Id;
            if (urOpportunity.isSuccess()) {          
                LegacyCRMLead__c crmLead = crmLeadToUpdate.containsKey(crmLeadId) ? crmLeadToUpdate.get(crmLeadId) : new LegacyCRMLead__c(Id = crmLeadId);
                crmLead.Converted_to_Opportunity__c = true;
                crmLeadToUpdate.put(crmLeadId, crmLead);
                convertedOppCRMId.add(convertedAccCRMId[k]);
            } else {
                String errorMessage = '';
                for (Database.Error err : urOpportunity.getErrors()) {
                    errorMessage += err.getMessage() + '. ';
                }
                ApplicationLogger.logDMLException('Conversion from Legacy CRM Lead to Opportunity is failed', crmLeadId, errorMessage, true);
            }
            k++;
        }
    }

    //Upsert all the program plan records from legacy CRM based on the external lead Id.
    private void upsertProgramPlans(List<Program_Plan__c> programPlanList, Map<String, LegacyCRMLead__c> customLeadMap, Map<Id, LegacyCRMLead__c> crmLeadToUpdate, List<String> convertedOppCRMId) {
        Integer l = 0;
        for (Database.UpsertResult urProgramPlan : Database.upsert(programPlanList, Program_Plan__c.Fields.External_Legacy_CRM_Id__c, false)) {
            Id crmLeadId = customLeadMap.get(convertedOppCRMId[l]).Id;
            if (urProgramPlan.isSuccess()) {          
                LegacyCRMLead__c crmLead = crmLeadToUpdate.containsKey(crmLeadId) ? crmLeadToUpdate.get(crmLeadId) : new LegacyCRMLead__c(Id = crmLeadId);
                crmLead.Converted_to_Program_Plan__c = true;
                crmLeadToUpdate.put(crmLeadId, crmLead);
            } else {
                String errorMessage = '';
                for (Database.Error err : urProgramPlan.getErrors()) {
                    errorMessage += err.getMessage() + '. ';
                }
                ApplicationLogger.logDMLException('Conversion from Legacy CRM Lead to Program Plan is failed', crmLeadId, errorMessage, true);
            }
            l++;
        }    
    }

    //Insert all the opportunity contact role records from legacy CRM lead.
    private void createOpportunityContactRoles(List<OpportunityContactRole> oppContactRoleList, Map<String, LegacyCRMLead__c> customLeadMap, Map<Id, LegacyCRMLead__c> crmLeadToUpdate, List<String> convertedOppCRMId) {
        Integer m = 0;
        for (Database.SaveResult srOppContRole : Database.insert(oppContactRoleList, false)) {
            Id crmLeadId = customLeadMap.get(convertedOppCRMId[m]).Id;
            if (srOppContRole.isSuccess()) {          
                LegacyCRMLead__c crmLead = crmLeadToUpdate.containsKey(crmLeadId) ? crmLeadToUpdate.get(crmLeadId) : new LegacyCRMLead__c(Id = crmLeadId);
                crmLead.Converted_to_OpportunityContactRole__c  = true;
                crmLeadToUpdate.put(crmLeadId, crmLead);
            } else {
                String errorMessage = '';
                for (Database.Error err : srOppContRole.getErrors()) {
                    errorMessage += err.getMessage() + '. ';
                }
                ApplicationLogger.logDMLException('Conversion from Legacy CRM Lead to Opportunity Contact Role is failed', crmLeadId, errorMessage, true);
            }
            m++;
        }
    }

    private void updateLegacyCRMLead(List<LegacyCRMLead__c> crmLeadToUpdateList) {
        Integer n = 0;
        for (Database.SaveResult saveResult : Database.update(crmLeadToUpdateList, false)) {
            if (!saveResult.isSuccess()) {
                String errorMessage = '';
                for (Database.Error err : saveResult.getErrors()) {
                    errorMessage += err.getMessage() + '. ';
                }
                ApplicationLogger.logDMLException('Updating legacy crm lead to mark converted successfully is failed', crmLeadToUpdateList[n].Id, errorMessage, true);
            }
            n++;
        }
    }*/
}