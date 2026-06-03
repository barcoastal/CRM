/**
 * @Descritpion: Schedule class to invoke the Batch_SAS_GetDraftUpdates
 * This will do callout to get the draft status updated record for all customer from SAS processor
 * And it will update the draft status in the draft record based on the callout response
 */
public without sharing class ScheduleSASGetDraftUpdates implements Schedulable {

    public void execute(SchedulableContext sc) {
        Database.executeBatch(new Batch_SAS_GetDraftUpdates());
    }
}