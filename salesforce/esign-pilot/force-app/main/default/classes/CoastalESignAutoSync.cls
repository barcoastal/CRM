/** Sandbox pilot only. Schedule one instance for the explicitly selected Opportunity.
 * Failed workers remain visible in Apex Jobs and retry on the next scheduled run.
 */
public with sharing class CoastalESignAutoSync implements Schedulable {
    private Id recordId;
    public CoastalESignAutoSync(Id opportunityId) { recordId=opportunityId; }
    public void execute(SchedulableContext context) {
        if(![SELECT IsSandbox FROM Organization LIMIT 1].IsSandbox ||
            !FeatureManagement.checkPermission('Coastal_ESign_Pilot')) return;
        // Avoid building a backlog if Salesforce or the CRM is temporarily slow.
        if([SELECT count() FROM AsyncApexJob WHERE ApexClass.Name='CoastalESignSyncWorker'
            AND Status IN ('Holding','Queued','Preparing','Processing')] > 0) return;
        System.enqueueJob(new CoastalESignSyncWorker(recordId));
    }
}
