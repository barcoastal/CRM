public with sharing class SAS_DraftSyncController {

    @AuraEnabled
    public static void syncClientDrafts(Id accountId) {
        try {
         
            Account acc = AccountData.queryAccountWithId(accountId);

            if (String.isBlank(acc.external_SAS_Id__c)) {
                throw new AuraHandledException('This client is not yet synced with SAS.');
            }

            SAS_ClientDraftSyncService.syncDraftsForClient(acc.external_SAS_Id__c, accountId);

        } catch (Exception ex) {
            ApplicationLogger.logException(ex, 'LWC SAS_DraftSyncController Error');
            throw new AuraHandledException('Sync Failed: ' + ex.getMessage());
        }
    }
}