/**
 * @Descritpion: Schedule class to invoke the BatchSASGetPaymentStatus
 * This will do callout to get the status of the payment from SAS processor
 * And it will update the payment status in the draft record from the callout response
 */
public without sharing class ScheduleSASGetPaymentStatus implements Schedulable {

    public void execute(SchedulableContext sc) {
        Database.executeBatch(new BatchSASGetPaymentStatus());
    }
}