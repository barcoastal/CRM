public class Schedule_ArchDupeLeadsOfConvertedLeads implements Schedulable {
    public static Integer batchSize = 200;
    
    public void execute(SchedulableContext sc) {
        Batch_ArchiveDupeLeadsOfConvertedLeads batchArchiveDupeLeads = new Batch_ArchiveDupeLeadsOfConvertedLeads(); 
        database.executeBatch(batchArchiveDupeLeads, batchSize);
    }
}