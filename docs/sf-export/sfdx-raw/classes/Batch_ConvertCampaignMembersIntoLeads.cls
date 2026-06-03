public without sharing class Batch_ConvertCampaignMembersIntoLeads implements Database.Batchable<SObject>, Database.stateful {

    public static Integer batchSize = 50;
    
    private Id campaignId;
    private String five9ListId;

    private Boolean appendLeadsAndAddToFive9;
    private Boolean addToFive9;
    private Boolean removeFromFive9;
    
    public static void appendLeadsAndAddToFive9(Id campaignId) {
        /*Batch_ConvertCampaignMembersIntoLeads batchInstance = new Batch_ConvertCampaignMembersIntoLeads(campaignId); 
        batchInstance.campaignId = campaignId;
        batchInstance.appendLeadsAndAddToFive9 = true;
        Database.executeBatch(batchInstance, batchSize);*/
        appendLeadsAndAddToFive9(campaignId, batchSize);
    }
    
    public static void appendLeadsAndAddToFive9(Id campaignId, Integer batchSizeParam) {
        Batch_ConvertCampaignMembersIntoLeads batchInstance = new Batch_ConvertCampaignMembersIntoLeads(campaignId); 
        batchInstance.campaignId = campaignId;
        batchInstance.appendLeadsAndAddToFive9 = true;
        Database.executeBatch(batchInstance, batchSizeParam);
    }

    public static void addLeadsToFive9(Id campaignId) {
        Batch_ConvertCampaignMembersIntoLeads batchInstance = new Batch_ConvertCampaignMembersIntoLeads(campaignId); 
        batchInstance.campaignId = campaignId;
        batchInstance.addToFive9 = true;
        Database.executeBatch(batchInstance, batchSize);
    }

    public static void removeLeadsFromFive9(Id campaignId) {
        Batch_ConvertCampaignMembersIntoLeads batchInstance = new Batch_ConvertCampaignMembersIntoLeads(campaignId); 
        batchInstance.campaignId = campaignId;
        batchInstance.removeFromFive9 = true;
        Database.executeBatch(batchInstance, batchSize);
    }

    private Batch_ConvertCampaignMembersIntoLeads(String campaignId) {
        if (String.isBlank(campaignId)) {
            CustomException.variableBlankException('Campaign Id');
        }
        List<Campaign> campaignList = CampaignData.queryCampaign(campaignId);
        if (campaignList != null && !campaignList.isEmpty()) {
            five9ListId = campaignList[0].Five9_lsp2_List_Id__c;
            //need to change to new five9ListId
            if (String.isBlank(five9ListId)) {
                CustomException.variableBlankException('Five9 List Id');
            }
            List<Append_Leads_Config__mdt> configs = AppendLeadsConfigData.queryAppendLeadsConfig();
            if (configs != null && !configs.isEmpty()) {
                if (configs[0].Batch_Size__c != null && configs[0].Batch_Size__c > 0) {
                    batchSize = Integer.valueOf(configs[0].Batch_Size__c);
                }   
            } else {
                CustomException.variableBlankException('Append Lead Config Metadata');
            }
        }
    }
    
    public Database.QueryLocator start(Database.BatchableContext bc) {
        try {
            Id preLeadRTId = LeadUtil.getRecordTypeId(LeadUtil.RT_PRE_LEAD);
            String leadArchivedStatus = LeadUtil.LEAD_ARCHIVED_STATUS;
            String query = 'SELECT Id, Phone, Email, LeadId, Lead.RecordTypeId, Append_Lead_Status__c FROM CampaignMember WHERE CampaignId = :campaignId';
            if (appendLeadsAndAddToFive9 == true) {
                query += ' AND Lead.RecordTypeId = :preLeadRTId AND (lead.Outbound_ANI_Identifier__c != Null OR lead.Outbound_ANI_From__c != null) AND Lead.Status !=:leadArchivedStatus';
            } else if (addToFive9 == true) {
                Set<String> syncStatusesToAddFive9 = new Set<String> {'Removed', 'UnSynced', null};
                query += ' AND Five9_Sync_Status__c IN :syncStatusesToAddFive9';
            } else if (removeFromFive9 == true) {
                Set<String> syncStatusesToRemoveFive9 = new Set<String> {'Added'};
                query += ' AND Five9_Sync_Status__c IN :syncStatusesToRemoveFive9';
            }
            return Database.getQueryLocator(query);
        } catch(Exception ex) {
            ApplicationLogger.logException(ex, campaignId);
        }
        return null;
    }

    public void execute(Database.BatchableContext bc, List<CampaignMember> scope) {
        try {
            List<CampaignMember> campignMemberToUpdateList = new List<CampaignMember>();
            Set<Id> leadIds = new Set<Id>();
            for (CampaignMember campaignMemberRecord : scope) {
                leadIds.add(campaignMemberRecord.LeadId);
            }
            if (!leadIds.isEmpty()) {
                LeadService.LeadServiceResult leadSvcResult;
                if (appendLeadsAndAddToFive9 == true) {
                    leadSvcResult = LeadService.appendLeadsAndAddToFive9(leadIds, five9ListId);
                } else if (addToFive9 == true) {
                    leadSvcResult = LeadService.addToFive9(leadIds, five9ListId);
                } else if (removeFromFive9 == true) {
                    leadSvcResult = LeadService.removeFromFive9(leadIds, five9ListId);
                }
                if (leadSvcResult != null) {
                    if (leadSvcResult.isSuccess) {
                        Map<Id, LeadService.LeadResult> leadSvcResultMap = leadSvcResult.leadInstanceResult;
                        if (leadSvcResultMap != null && !leadSvcResultMap.isEmpty()) {
                            for (CampaignMember campaignMemberRecord : scope) {
                                CampaignMember campignMemberToUpdate = new CampaignMember();
                                campignMemberToUpdate.Id = campaignMemberRecord.Id;
                                if (leadSvcResultMap.containsKey(campaignMemberRecord.LeadId)) {
                                    LeadService.LeadResult leadResult = leadSvcResultMap.get(campaignMemberRecord.LeadId);
                                    if (leadResult.isSuccess) {
                                        if (appendLeadsAndAddToFive9 == true) {
                                            campignMemberToUpdate.Append_Lead_Status__c = CampaignMemberUtil.CAMP_MEMBER_STATUS_COMPLETED;
                                            if (leadResult.additionalValues != null && !leadResult.additionalValues.isEmpty() && leadResult.additionalValues.containsKey(LeadUtil.UNIQUE_LEAD_CONVERSION)) {
                                                if (leadResult.additionalValues.get(LeadUtil.UNIQUE_LEAD_CONVERSION) == 'true') {
                                                    campignMemberToUpdate.Lead_Conversion_Type__c = 'Unique Lead';
                                                } else if (leadResult.additionalValues.get(LeadUtil.UNIQUE_LEAD_CONVERSION) == 'false') {
                                                    campignMemberToUpdate.Lead_Conversion_Type__c = 'Duplicate Lead';
                                                }
                                            }
                                        }
                                        if (appendLeadsAndAddToFive9 == true || addToFive9 == true) {
                                            campignMemberToUpdate.Five9_Sync_Status__c = CampaignMemberUtil.CAMP_MEMBER_FIVE9_ADDED_STATUS;
                                        } else if (removeFromFive9 == true) {
                                            campignMemberToUpdate.Five9_Sync_Status__c = CampaignMemberUtil.CAMP_MEMBER_FIVE9_REMOVED_STATUS;
                                        }
                                        campignMemberToUpdate.Process_Message__c = null;
                                    } else {
                                        if (appendLeadsAndAddToFive9 == true) {
                                            campignMemberToUpdate.Append_Lead_Status__c = CampaignMemberUtil.CAMP_MEMBER_STATUS_FAILED;
                                        }
                                        if (String.isNotBlank(leadResult.customError)) {
                                            campignMemberToUpdate.Process_Message__c = leadResult.customError;
                                        } else if (leadResult.dmlResult != null && leadResult.dmlResult.getErrors() != null && !leadResult.dmlResult.getErrors().isEmpty()) {
                                            String errorMessage = '';
                                            for (Database.Error err : leadResult.dmlResult.getErrors()) {
                                                errorMessage += err.getMessage() + '. ';
                                            }
                                            campignMemberToUpdate.Process_Message__c = errorMessage;
                                        }
                                    }
                                } else {
                                    campignMemberToUpdate.Append_Lead_Status__c = CampaignMemberUtil.CAMP_MEMBER_STATUS_FAILED;
                                    campignMemberToUpdate.Process_Message__c = 'Lead Result is Empty';
                                }
                                campignMemberToUpdateList.add(campignMemberToUpdate);
                            }
                        } else {
                            ApplicationLogger.logDetails('Batch_ConvertCampaignMembersIntoLeads', campaignId, 'Lead Result Map is Empty');
                            ApplicationLogger.insertStoredLogs();
                        }
                    } else {
                        ApplicationLogger.logDetails('Batch_ConvertCampaignMembersIntoLeads', campaignId, leadSvcResult.customError);
                        ApplicationLogger.insertStoredLogs();
                    }
                } else {
                    ApplicationLogger.logDetails('Batch_ConvertCampaignMembersIntoLeads', campaignId, 'Lead Service Result is Empty');
                    ApplicationLogger.insertStoredLogs();
                }
                if (!campignMemberToUpdateList.isEmpty()) {
                    update campignMemberToUpdateList;
                }
            }
        } catch(Exception ex) {
            ApplicationLogger.logException(ex, campaignId);
        }
    }

    public void finish(Database.BatchableContext bc) {
        if (campaignId != null) {
            try {
                Campaign cmpInstance = new Campaign();
                cmpInstance.Id = this.campaignId;
                if (addToFive9 == true) {
                    cmpInstance.Status = 'Active';
                } else if (removeFromFive9 == true) {
                    cmpInstance.Status = 'Inactive';
                } else if (appendLeadsAndAddToFive9 == true) {
                    cmpInstance.Status = 'Appended Lead and Activated';
                }           
                Database.SaveResult saveResult = Database.update(cmpInstance, false);
                if (!saveResult.isSuccess()) {
                    String errorMessage;
                    for (Database.Error err : saveResult.getErrors()) {
                        errorMessage += err.getMessage() + '. ';
                    }
                    ApplicationLogger.logDMLException('Updating campaign status got failed', saveResult.getId(), errorMessage);
                }
            } catch(Exception ex) {
                ApplicationLogger.logException(ex, campaignId);
            }
        }
       // Integer batchSize = IPQSSettingsUtility.getBatchSize();
       // String asyncType = AsyncOperationUtil.ASYNC_TYPE_ENUM.BATCH.toString();
      //  String operation = AsyncOperationUtil.OPERATION_IP_QUALITY_SCORE_CHECK;
      //  String queryString = 'SELECT Id, Operation__c FROM Async_Operation__c WHERE Status__c = :STATUS_PENDING AND Async_Type__c = \'' + asyncType + '\' AND Operation__c = \'' + operation + '\'  ORDER BY Operation__c';
       // Database.executeBatch(new Batch_ProcessAsyncOperations(queryString), batchSize);
    }
}