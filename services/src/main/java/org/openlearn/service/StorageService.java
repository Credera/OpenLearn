package org.openlearn.service;

import com.amazonaws.AmazonServiceException;
import com.amazonaws.services.s3.AmazonS3;
import com.amazonaws.services.s3.AmazonS3ClientBuilder;
import com.amazonaws.services.s3.model.*;
import com.google.common.collect.Lists;
import org.openlearn.config.ApplicationProperties;
import org.openlearn.domain.*;
import org.openlearn.dto.FileInformationDTO;
import org.openlearn.repository.AssignmentRepository;
import org.openlearn.repository.CourseRepository;
import org.openlearn.repository.FileRepository;
import org.openlearn.repository.PortfolioItemRepository;
import org.openlearn.transformer.FileInformationTransformer;
import org.openlearn.web.rest.errors.FileInformationNotFoundException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.MalformedURLException;
import java.net.URL;
import java.time.ZonedDateTime;
import java.util.*;
import java.util.function.BiConsumer;

/**
 * Service Implementation for managing File upload.
 */
@Service
@Transactional
@EnableConfigurationProperties
public class StorageService {
	private static final Logger log = LoggerFactory.getLogger(AddressService.class);

	private final FileRepository fileRepository;

	private final CourseRepository courseRepository;

	private final AssignmentRepository assignmentRepository;

	private final UserService userService;

	private final PortfolioItemRepository portfolioItemRepository;

	private final FileInformationTransformer fileInformationTransformer;

	@Autowired
	private ApplicationProperties props;

	public StorageService(final FileRepository fileRepository,
						  final CourseRepository courseRepository,
						  final AssignmentRepository assignmentRepository,
						  final UserService userService,
						  final PortfolioItemRepository portfolioItemRepository,
						  final FileInformationTransformer fileInformationTransformer) {
		this.fileRepository = fileRepository;
		this.courseRepository = courseRepository;
		this.assignmentRepository = assignmentRepository;
		this.userService = userService;
		this.portfolioItemRepository = portfolioItemRepository;
		this.fileInformationTransformer = fileInformationTransformer;
	}

	/**
	 * Store a file.
	 *
	 * @return the persisted entity
	 */
	//TODO cbernal fix blue documentation
	public FileInformationDTO store(final MultipartFile file, Long assignmentId, Long portfolioId) {
		log.debug("Request to save f : {}", file); //TODO cbernal fix this log statement

		User user = userService.getCurrentUser();
		AmazonS3 s3client = AmazonS3ClientBuilder.defaultClient();
		String uploadBucketName = props.getUploadBucket();
		String keyName = createS3FilePrefix(assignmentId, portfolioId, user.getId()) + file.getOriginalFilename();
		try {
			File f = convertToFile(file);
			s3client.putObject(new PutObjectRequest(uploadBucketName, keyName, f));
			f.delete();
		} catch (AmazonServiceException e) {
			log.error(e.getErrorMessage());
		} catch (Exception e) {
			log.error(e.getMessage());
		}


		FileInformation fileInformation = new FileInformation();
		fileInformation.setFileUrl("https://s3.amazonaws.com/" + uploadBucketName + "/" + keyName);
		fileInformation.setUploadedByUser(user);
		fileInformation.setCreatedDate(ZonedDateTime.now());
		if (assignmentId != null) {
			Assignment assignment = assignmentRepository.findOne(assignmentId);
			Course course = assignment.getCourse();
			fileInformation.setAssignment(assignment);
			fileInformation.setUser(course.getInstructor());
			fileInformation.setFileType("Assignment");
		} else {
			PortfolioItem portfolioItem = portfolioItemRepository.findOne(portfolioId);
			fileInformation.setPortfolioItem(portfolioItem);
			fileInformation.setUser(portfolioItem.getStudent());
			fileInformation.setFileType("Portfolio");
		}

		return fileInformationTransformer.transform(fileRepository.save(fileInformation));
	}

	private static File convertToFile(MultipartFile file) throws IOException {
		File convertedFile = new File(file.getOriginalFilename());
		convertedFile.createNewFile();
		FileOutputStream fos = new FileOutputStream(convertedFile);
		fos.write(file.getBytes());
		fos.close();
		return convertedFile;
	}

	public InputStream getUpload(Long fileInformationId) {
		AmazonS3 s3client = AmazonS3ClientBuilder.defaultClient();
		FileInformation fileInformation = fileRepository.findOne(fileInformationId);

		if (fileInformation == null) throw new FileInformationNotFoundException(fileInformationId);

		String bucket = retrieveBucket(fileInformation);
		String key = retrieveKeyName(fileInformation);

		log.debug("Retrieving file at " + bucket);

		try {
			S3Object s3Object = s3client.getObject(new GetObjectRequest(bucket, key));
			InputStream objectData = s3Object.getObjectContent();
			return objectData;
		} catch(Exception e) {
			log.error(e.getMessage());
			return null;
		}
	}

	public void deleteUpload(Long fileInformationId) {
		FileInformation fileInformation = fileRepository.findOne(fileInformationId);

		if (fileInformation == null) throw new FileInformationNotFoundException(fileInformationId);
		deleteUpload(fileInformation);
	}

	public void deleteUpload(FileInformation fileInformation) {
		AmazonS3 s3client = AmazonS3ClientBuilder.defaultClient();
		String bucket = retrieveBucket(fileInformation);
		String key = retrieveKeyName(fileInformation);

		try {
			s3client.deleteObject(new DeleteObjectRequest(bucket, key));
			fileRepository.delete(fileInformation);
		} catch(Exception e) {
			log.error(e.getMessage());
		}
	}

	public void deleteUploads(List<FileInformation> files) {
		AmazonS3 s3client = AmazonS3ClientBuilder.defaultClient();
		List<String> buckets = Lists.transform(files, this::retrieveBucket);
		List<String> keys = Lists.transform(files, this::retrieveKeyName);

		Map<String, List<String>> bucketToKeys = new HashMap<>();

		// Test if there's only one bucket (which will be the typical case)
		Set<String> uniqueBuckets = new HashSet<>(buckets);
		if (uniqueBuckets.size() > 1) {
			bucketToKeys.put(buckets.get(0), keys);
		} else { // There are multiple buckets in the given file set

			for (int index = 0; index < buckets.size(); index++) {
				String bucket = buckets.get(index);
				String key = keys.get(index);
				if (bucketToKeys.containsKey(bucket)) {
					bucketToKeys.get(bucket).add(key);
				} else {
					List<String> list = new ArrayList<>();
					list.add(key);
					bucketToKeys.put(bucket, list);
				}
			}
		}

		bucketToKeys.forEach((bucket, keys1) -> {
            DeleteObjectsRequest request = new DeleteObjectsRequest(bucket);
            List<DeleteObjectsRequest.KeyVersion> keyVersions = new ArrayList<>(keys1.size());
            for (String key : keys1)
                keyVersions.add(new DeleteObjectsRequest.KeyVersion(key));
            request.setKeys(keyVersions);
            s3client.deleteObjects(request);
        });
	}

	private String createS3FilePrefix(Long assignmentId, Long portfolioId, Long uploadedByUserId) {
		// s3 file name is a_[assignmentid]_[filename] for assignments and p_[portfolioid]_[filename] for portfolios
		// and a unique GUID hash.
		String assignmentStr = assignmentId != null ? "a_" + assignmentId.toString() + "/" : "";
		String portfolioStr = portfolioId != null ? "p_" + portfolioId.toString() + "/" : "";
		String userStr = uploadedByUserId.toString();
		String prefix = assignmentStr + portfolioStr + userStr + "/";
		return prefix;
	}

	private String retrieveBucket(FileInformation fileInformation) {
		String bucketAndKey = retrieveFullPath(fileInformation);
		int separatingIndex = bucketAndKey.indexOf("/");
		return bucketAndKey.substring(0, separatingIndex);
	}

	private String retrieveKeyName(FileInformation fileInformation) {
		String bucketAndKey = retrieveFullPath(fileInformation);
		int separatingIndex = bucketAndKey.indexOf("/");
		return bucketAndKey.substring(separatingIndex+1);
	}

	private String retrieveFullPath(FileInformation fileInformation) {
		String bucketAndKey;
		try {
			bucketAndKey = new URL(fileInformation.getFileUrl()).getPath()
				.replaceFirst("/", "");
		} catch (MalformedURLException e) {
			log.info("File URL is malformed, Falling back on prefix and bucket logic");
			Assignment assignment = fileInformation.getAssignment();
			PortfolioItem portfolioItem = fileInformation.getPortfolioItem();
			String bucket = props.getUploadBucket();
			String key = fileInformation.getFileUrl().substring(
				fileInformation.getFileUrl().lastIndexOf("/")+1
			);
			bucketAndKey = bucket + "/" + key;
		}

		return bucketAndKey;
	}
}

