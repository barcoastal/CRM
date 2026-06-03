public without sharing class Batch_ArchiveDupeLeadsOfConvertedLeads implements Database.Batchable<SObject> {
    
    public Date fromDate;

    public Batch_ArchiveDupeLeadsOfConvertedLeads() {
        this.fromDate = System.today().addDays(-1);
    }

    public Batch_ArchiveDupeLeadsOfConvertedLeads(Date fromDate) {
        this.fromDate = fromDate;
    }
    
    
    public Database.QueryLocator start(Database.BatchableContext bc) {
        String query = 'SELECT Id FROM Lead WHERE IsConverted = true AND ConvertedDate >= :fromDate AND Archived_Duplicate_Leads__c = false';
        return Database.getQueryLocator(query);
    }

    public void execute(Database.BatchableContext bc, List<Lead> scope) {
        Set<Id> leadIds = new Set<Id>();
        for (Lead leadRecord : scope) {
            leadIds.add(leadRecord.Id);
        }
        LeadService.LeadServiceResult leadSvcResult = LeadService.archiveLeads(leadIds);
        if (leadSvcResult != null) {
            if (leadSvcResult.isSuccess) {
                Map<Id, LeadService.LeadResult> leadSvcResultMap = leadSvcResult.leadInstanceResult;
                if (leadSvcResultMap != null && !leadSvcResultMap.isEmpty()) {
                    for (Lead leadRecord : scope) {
                        if (leadSvcResultMap.containsKey(leadRecord.Id)) {
                            LeadService.LeadResult leadResult = leadSvcResultMap.get(leadRecord.Id);
                            String errorMessage = '';
                            if (!leadResult.isSuccess) {
                                if (String.isNotBlank(leadResult.customError)) {
                                    errorMessage = leadResult.customError;
                                } else if (leadResult.dmlResult != null && leadResult.dmlResult.getErrors() != null && !leadResult.dmlResult.getErrors().isEmpty()) {
                                    for (Database.Error err : leadResult.dmlResult.getErrors()) {
                                        errorMessage += err.getMessage() + '. ';
                                    }
                                }
                                ApplicationLogger.logDetails('Batch_ArchiveDupeLeadsOfConvertedLeads', leadRecord.Id, errorMessage);
                                ApplicationLogger.insertStoredLogs();
                            }
                        } else {
                            ApplicationLogger.logDetails('Batch_ArchiveDupeLeadsOfConvertedLeads', leadRecord.Id, 'Lead Result is Empty');
                            ApplicationLogger.insertStoredLogs();
                        }
                    }
                } else {
                    ApplicationLogger.logDetails('Batch_ArchiveDupeLeadsOfConvertedLeads', null, 'Lead Result Map is Empty');
                    ApplicationLogger.insertStoredLogs();
                }
            } else {
                ApplicationLogger.logDetails('Batch_ArchiveDupeLeadsOfConvertedLeads', null, leadSvcResult.customError);
                ApplicationLogger.insertStoredLogs();
            }
        } else {
            ApplicationLogger.logDetails('Batch_ArchiveDupeLeadsOfConvertedLeads', null, 'Lead Service Result is Empty');
            ApplicationLogger.insertStoredLogs();
        }
    }

    public void finish(Database.BatchableContext bc) {
    }
}