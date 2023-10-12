import { getAuthSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { SubredditValidator } from '@/lib/validators/subreddit';
import { z } from 'zod';

export async function POST(req: Request) {
  try {
    // To check if the user has logged in, we are using getAuthSession and not getServerSession! It was my mistake
    const session = await getAuthSession();

    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    // In Next 13 we don't write req.body but rather: req.json();
    const body = await req.json();

    // Users can pass anything into the input POST field,
    // we need to make sure that the user is inserting only that data which we are expecting
    // So we destructure the incoming data and pass: SubredditValidator().parse(body) function where
    // the SubredditValidator would only accept a 'name' prpoperty inside it, and we don't need to worry about data valiation
    const { name } = SubredditValidator.parse(body);

    // To check if the subreddit with the same name already exists
    const subredditExists = await db.subreddit.findFirst({
      where: {
        name,
      },
    });

    if (subredditExists) {
      return new Response('Subreddit of the same name already exists', {
        status: 409,
      });
    }

    // Create a new subreddit
    // The creatorId would be the logged in User itself
    const subreddit = await db.subreddit.create({
      data: {
        name,
        creatorId: session.user.id,
      },
    });

    // If the User has created a new subreddit, He would be the owner of that subreddit
    // So the Subscription would have user ID and the Subreddit ID
    await db.subscription.create({
      data: {
        userId: session.user.id,
        subredditId: subreddit.id,
      },
    });

    return new Response(subreddit.name);
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Unprocessable Entitiy (Data is not valid)
      return new Response(error.message, { status: 422 });
    }

    return new Response('Could not create Subreddit', { status: 500 });
  }
}
