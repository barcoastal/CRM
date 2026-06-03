/**
 * @Descritpion: Schedule class to invoke the Batch_ShareLeadToMCA 
 * This will update MCA Lender External Id field when updating the lead five9 disposition or subdisposition
 */
public without sharing class ScheduleShareLeadToMCA  implements Schedulable {

    public void execute(SchedulableContext sc) {
        Database.executeBatch(new Batch_ShareLeadToMCA(), 1);
    }
}