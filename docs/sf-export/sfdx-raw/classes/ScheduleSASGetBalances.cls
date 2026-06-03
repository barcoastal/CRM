/**
 * @Descritpion: Schedule class to invoke the BatchSASGetBalances
 * This will do callout to get the trust balances for all customer from SAS processor
 * And it will update the current balance in the Account based on the callout response
 */
public without sharing class ScheduleSASGetBalances implements Schedulable {

    public void execute(SchedulableContext sc) {
        Database.executeBatch(new BatchSASGetBalances());
    }
}