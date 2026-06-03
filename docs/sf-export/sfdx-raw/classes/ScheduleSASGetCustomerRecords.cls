/**
 * @Descritpion: Schedule class to invoke the BatchSASGetCustomerRecords
 * This will do callout to get the customer information from SAS processor
 * And it will update the custmer details in the Account based on the callout response
 */
public without sharing class ScheduleSASGetCustomerRecords implements Schedulable {

    public Datetime startDateTime;
    public Datetime endDateTime;

    public void execute(SchedulableContext sc) {
        if (this.startDateTime != null || this.endDateTime != null) {
            Database.executeBatch(new BatchSASGetCustomerRecords(this.startDateTime, this.endDateTime));
        } else {
            Database.executeBatch(new BatchSASGetCustomerRecords());
        }
    }
}