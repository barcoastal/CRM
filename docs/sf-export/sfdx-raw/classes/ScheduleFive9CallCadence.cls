/**
 * @Descritpion: Schedule class to invoke the Batch_Five9CallCadence
 * This will update redial time and delete five9 id list on lead, opportunity and contact.
 */
public without sharing class ScheduleFive9CallCadence implements Schedulable {

    public void execute(SchedulableContext sc) {
        Database.executeBatch(new Batch_Five9CallCadence());
    }
}