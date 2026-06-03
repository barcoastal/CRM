/*----------------------------------------------------------------
    Author: Dharanya Sekar
    Description: A schedule class to invoke Batch_SyncToFive9List to re-sync the lead to five9 list.
    Test Class: Schedule_SyncToFive9List_Test

    History
    <Date>          <Authors Name>          <Brief Description of Change>       <Code Coverage>
    Dec-07-2023     Dharanya Sekar          Initial Development                 100%
--------------------------------------------------------------------*/
public without sharing class Schedule_SyncToFive9List implements Schedulable{

    public void execute(SchedulableContext sc) {
        //invoke the batch class
        Database.executeBatch(new Batch_SyncToFive9List(), 200);
    }
}