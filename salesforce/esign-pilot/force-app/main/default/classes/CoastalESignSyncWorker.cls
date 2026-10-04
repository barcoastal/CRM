public with sharing class CoastalESignSyncWorker implements Queueable, Database.AllowsCallouts {
    private Id recordId;
    public CoastalESignSyncWorker(Id opportunityId) { recordId=opportunityId; }
    public void execute(QueueableContext context) {
        if(![SELECT IsSandbox FROM Organization LIMIT 1].IsSandbox ||
            !FeatureManagement.checkPermission('Coastal_ESign_Pilot')) return;
        List<Opportunity> rows=[SELECT Id,Account.Name,Coastal_Esign_Packet_Id__c,
            Coastal_Esign_Status__c,Coastal_Esign_File_Id__c FROM Opportunity
            WHERE Id=:recordId WITH USER_MODE];
        if(rows.isEmpty()) return;
        Opportunity o=rows[0];
        if(o.Account==null || !o.Account.Name.startsWith('TEST -') || String.isBlank(o.Coastal_Esign_Packet_Id__c)) return;
        if(o.Coastal_Esign_Status__c=='COMPLETED' && !String.isBlank(o.Coastal_Esign_File_Id__c)) return;
        if(new Set<String>{'DECLINED','VOIDED','EXPIRED'}.contains(o.Coastal_Esign_Status__c)) return;
        CoastalESignPilotController.refreshStatus(recordId);
    }
}
